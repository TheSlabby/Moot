#include <boost/asio.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/json.hpp>
#include <boost/beast/websocket.hpp>
#include <iostream>
#include <functional>
#include <unordered_map>
#include <string>
#include "Database.hpp"

namespace asio = boost::asio;
namespace beast = boost::beast;
namespace http = beast::http;
namespace websocket = beast::websocket;
namespace json = boost::json;
using tcp = asio::ip::tcp;

static Database database("moot.sqlite");

struct Session {
    websocket::stream<beast::tcp_stream> ws;
    int64_t userID {-1};
};
using Handler = std::function<asio::awaitable<void>(Session&, const json::value&)>;


// HANDLERS
asio::awaitable<void> handle_identify(Session& session, const json::value& v)
{
    std::cout << "HANDLING IDENTIFY" << std::endl;
    auto token = std::string(v.at("token").as_string());

    auto userID = database.resolveToken(token);
    if (userID) {
        session.userID = *userID;
        std::cout << "resolved token: " << token << " -> " << *userID << std::endl;
    } else {
        std::cerr << "couldn't resolve token: " << token << std::endl;
    }

    co_return;
}

// dispatch map: op name -> handler
std::unordered_map<std::string, Handler> dispatchMap = {
    {"IDENTIFY", handle_identify},
};

// WEBSOCKET
asio::awaitable<void> handle_websocket(beast::tcp_stream stream, http::request<http::string_body> req) {
    // websocket stream session
    Session session{
        websocket::stream<beast::tcp_stream>{std::move(stream)}
    };
    session.ws.set_option(websocket::stream_base::timeout::suggested(beast::role_type::server));
    co_await session.ws.async_accept(req, asio::use_awaitable); // finish handshake

    while (true)
    {
        beast::flat_buffer buffer;
        co_await session.ws.async_read(buffer, asio::use_awaitable); // read to buffer

        std::string msg = beast::buffers_to_string(buffer.data());

        // json parse
        try {
            json::value v = json::parse(msg);
            std::string op{v.at("op").as_string()};
            const json::value& payload = v.at("d");

            std::cout << "got msg: " << msg << ", OPERATION: " << op << std::endl;

            // dispatch
            if (auto it = dispatchMap.find(op); it != dispatchMap.end()) {
                co_await it->second(session, payload);
            } else {
                std::cerr << "unknown op: " << op << std::endl;
            }
        } catch (const std::exception& e) {
            std::cerr << "bad msg: " << e.what() << std::endl;
        }
    }
}

asio::awaitable<void> handle_connection(tcp::socket socket)
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

asio::awaitable<void> listen(asio::io_context& ioc, uint16_t port)
{
    std::cout << "LISTENING ON: " << port << std::endl;

    tcp::acceptor acceptor{ioc, tcp::endpoint{tcp::v4(), port}};

    while (true)
    {
        auto sock = co_await acceptor.async_accept(asio::make_strand(ioc), asio::use_awaitable);

        // NEW COROUTINE FOR THIS CONNECION
        asio::co_spawn(ioc, handle_connection(std::move(sock)), [](std::exception_ptr e) {
            if (e) std::cerr << "connection closed" << std::endl;
        });
    }
}

int main(int argc, char* argv[])
{
    // create io ctx
    asio::io_context ioc{1};

    asio::co_spawn(ioc, listen(ioc, 8080), [](std::exception_ptr e) {
        if (e) std::rethrow_exception(e);
    });

    // tcp::acceptor acceptor{ioc, tcp::endpoint{tcp::v4(), 8080}};

    // auto sock = co_await acceptor.async_accept(asio::make_strand(ioc), asio::use_awaitable);

    ioc.run();

    return 0;
}