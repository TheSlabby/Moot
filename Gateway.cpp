#include "Gateway.hpp"
#include <iostream>
#include "Handlers.hpp"

Gateway::Gateway(asio::io_context& ioc, uint16_t listenPort, AppContext& ctx) :
    m_ioc(ioc),
    m_ctx(ctx)
{
    // spawn listen coroutine
    asio::co_spawn(ioc, listen(listenPort), [](std::exception_ptr e) {
        if (e) std::cerr << "failed to listen\n";
    });
}


asio::awaitable<void> Gateway::listen(uint16_t port)
{
    std::cout << "LISTENING ON: " << port << std::endl;

    tcp::acceptor acceptor{m_ioc, tcp::endpoint{tcp::v4(), port}};

    while (true)
    {
        auto sock = co_await acceptor.async_accept(asio::make_strand(m_ioc), asio::use_awaitable);

        // NEW COROUTINE FOR THIS CONNECION
        asio::co_spawn(m_ioc, handle_connection(std::move(sock)), [](std::exception_ptr e) {
            if (e) std::cerr << "connection closed" << std::endl;
        });
    }
}


asio::awaitable<void> Gateway::handle_connection(tcp::socket socket)
{
    // get tcp stream
    beast::tcp_stream stream(std::move(socket));
    stream.expires_after(std::chrono::seconds(30));

    beast::flat_buffer buffer;

    http::request<http::string_body> req;

    co_await http::async_read(stream, buffer, req, asio::use_awaitable);

    // CHECK IF WEBSOCKET
    if (websocket::is_upgrade(req)) {
        std::cout << "INCOMING WEBSOCKET CONNECTION" << std::endl;
        co_await handle_websocket(std::move(stream), std::move(req));
    } else {
        std::cout << "INCOMING REGULAR HTTP CONNECTION" << std::endl;
    }

}

// WEBSOCKET
asio::awaitable<void> Gateway::handle_websocket(beast::tcp_stream stream, http::request<http::string_body> req) {
    // websocket stream session
    auto session = std::make_shared<Session>(websocket::stream<beast::tcp_stream>(std::move(stream)));
    m_ctx.bus.subscribe(session);

    session->ws.set_option(websocket::stream_base::timeout::suggested(beast::role_type::server));
    co_await session->ws.async_accept(req, asio::use_awaitable); // finish handshake

    // send JSON as text frames, and greet the client with HELLO
    session->ws.text(true);
    {
        json::object hello{{"op", "HELLO"}, {"d", json::object{{"heartbeat_interval", 30000}}}};
        std::string out = json::serialize(hello);
        co_await session->ws.async_write(asio::buffer(out), asio::use_awaitable);
    }

    while (true)
    {
        beast::flat_buffer buffer;
        co_await session->ws.async_read(buffer, asio::use_awaitable); // read to buffer

        std::string msg = beast::buffers_to_string(buffer.data());

        // json parse
        try {
            json::value v = json::parse(msg);
            std::string op{v.at("op").as_string()};

            std::cout << "got msg: " << msg << ", OPERATION: " << op << std::endl;

            // dispatch — handlers receive the whole frame (so they can echo ref)
            if (auto it = Handlers::dispatchMap.find(op); it != Handlers::dispatchMap.end()) {
                co_await it->second(*session, v, m_ctx);
            } else {
                std::cerr << "unknown op: " << op << std::endl;
            }
        } catch (const std::exception& e) {
            std::cerr << "bad msg: " << e.what() << std::endl;
        }
    }
}

