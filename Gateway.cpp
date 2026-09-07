#include "Gateway.hpp"
#include <iostream>
#include <fstream>
#include <sstream>
#include <filesystem>
#include <random>
#include <cstring>
#include "Handlers.hpp"

// ---- small HTTP/upload helpers ----
static std::string queryParam(const std::string& target, const std::string& key)
{
    auto q = target.find('?');
    if (q == std::string::npos) return "";
    std::string qs = target.substr(q + 1);
    std::string needle = key + "=";
    size_t p = qs.find(needle);
    if (p == std::string::npos) return "";
    p += needle.size();
    size_t end = qs.find('&', p);
    return qs.substr(p, end == std::string::npos ? std::string::npos : end - p);
}
static std::string extForType(const std::string& ct)
{
    if (ct.find("png") != std::string::npos) return ".png";
    if (ct.find("jpeg") != std::string::npos || ct.find("jpg") != std::string::npos) return ".jpg";
    if (ct.find("gif") != std::string::npos) return ".gif";
    if (ct.find("webp") != std::string::npos) return ".webp";
    return ".bin";
}
static std::string mimeForName(const std::string& name)
{
    auto ends = [&](const char* s) { return name.size() >= std::strlen(s) && name.compare(name.size() - std::strlen(s), std::strlen(s), s) == 0; };
    if (ends(".png")) return "image/png";
    if (ends(".jpg")) return "image/jpeg";
    if (ends(".gif")) return "image/gif";
    if (ends(".webp")) return "image/webp";
    return "application/octet-stream";
}
static std::string randomName()
{
    static thread_local std::mt19937_64 rng{std::random_device{}()};
    std::uniform_int_distribution<int> d(0, 15);
    const char* hex = "0123456789abcdef";
    std::string s;
    for (int i = 0; i < 24; i++) s += hex[d(rng)];
    return s;
}

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

    // raised body limit so image uploads fit
    http::request_parser<http::string_body> parser;
    parser.body_limit(16 * 1024 * 1024);
    co_await http::async_read(stream, buffer, parser, asio::use_awaitable);
    auto req = parser.release();

    if (websocket::is_upgrade(req)) {
        co_await handle_websocket(std::move(stream), std::move(req));
    } else {
        co_await handle_http(std::move(stream), std::move(req));
    }
}

// ---- HTTP: file upload + serving (avatars, guild icons) ------------------
asio::awaitable<void> Gateway::handle_http(beast::tcp_stream stream, http::request<http::string_body> req)
{
    http::response<http::string_body> res;
    res.version(req.version());
    res.set(http::field::server, "Moot");
    res.set(http::field::access_control_allow_origin, "*");
    res.keep_alive(false);
    res.result(http::status::not_found);
    res.body() = "not found";

    std::string target(req.target());
    std::string path = target.substr(0, target.find('?'));

    try {
        if (req.method() == http::verb::post && path == "/upload") {
            std::string token = queryParam(target, "token");
            AppContext& ctx = m_ctx;
            auto uid = co_await asio::co_spawn(m_ctx.dbPool,
                [&ctx, token]() -> asio::awaitable<std::optional<int64_t>> { co_return ctx.db.resolveToken(token); },
                asio::use_awaitable);

            if (!uid) {
                res.result(http::status::unauthorized);
                res.body() = "unauthorized";
            } else {
                std::string name = randomName() + extForType(std::string(req[http::field::content_type]));
                std::string body = req.body();
                co_await asio::co_spawn(m_ctx.dbPool,
                    [name, body]() -> asio::awaitable<void> {
                        std::filesystem::create_directories("uploads");
                        std::ofstream f("uploads/" + name, std::ios::binary);
                        f.write(body.data(), static_cast<std::streamsize>(body.size()));
                        co_return;
                    }, asio::use_awaitable);
                res.result(http::status::ok);
                res.set(http::field::content_type, "application/json");
                res.body() = "{\"url\":\"/files/" + name + "\"}";
            }
        }
        else if (req.method() == http::verb::get && path.rfind("/files/", 0) == 0) {
            std::string name = path.substr(7);
            if (name.empty() || name.find('/') != std::string::npos || name.find("..") != std::string::npos) {
                res.result(http::status::bad_request);
                res.body() = "bad path";
            } else {
                auto data = co_await asio::co_spawn(m_ctx.dbPool,
                    [name]() -> asio::awaitable<std::string> {
                        std::ifstream f("uploads/" + name, std::ios::binary);
                        std::ostringstream ss; ss << f.rdbuf();
                        co_return ss.str();
                    }, asio::use_awaitable);
                if (data.empty() && !std::filesystem::exists("uploads/" + name)) {
                    res.result(http::status::not_found);
                    res.body() = "not found";
                } else {
                    res.result(http::status::ok);
                    res.set(http::field::content_type, mimeForName(name));
                    res.set(http::field::cache_control, "public, max-age=86400");
                    res.body() = std::move(data);
                }
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "http error: " << e.what() << std::endl;
        res.result(http::status::internal_server_error);
        res.body() = "error";
    }

    res.prepare_payload();
    co_await http::async_write(stream, res, asio::use_awaitable);
    beast::error_code ec;
    stream.socket().shutdown(tcp::socket::shutdown_send, ec);
}

// WEBSOCKET
asio::awaitable<void> Gateway::handle_websocket(beast::tcp_stream stream, http::request<http::string_body> req) {
    // websocket stream session
    auto session = std::make_shared<Session>(websocket::stream<beast::tcp_stream>(std::move(stream)));
    m_ctx.bus.subscribe(session);

    session->ws.set_option(websocket::stream_base::timeout::suggested(beast::role_type::server));
    co_await session->ws.async_accept(req, asio::use_awaitable); // finish handshake

    // send JSON as single text frames (no fragmentation) and greet with HELLO
    session->ws.text(true);
    session->ws.auto_fragment(false);
    {
        json::object hello{{"op", "HELLO"}, {"d", json::object{{"heartbeat_interval", 30000}}}};
        std::string out = json::serialize(hello);
        co_await session->ws.async_write(asio::buffer(out), asio::use_awaitable);
    }

    try {
        while (true)
        {
            beast::flat_buffer buffer;
            co_await session->ws.async_read(buffer, asio::use_awaitable); // read to buffer

            std::string msg = beast::buffers_to_string(buffer.data());

            // per-frame guard: one bad frame must not drop the connection
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
    } catch (const std::exception&) {
        // read failed -> the connection dropped; fall through to announce offline
    }

    // announce this user went offline (if they had identified)
    if (session->userID >= 0) {
        json::object pres{
            {"op", "PRESENCE"},
            {"d", json::object{
                {"user_id", std::to_string(session->userID)},
                {"username", session->username},
                {"online", false},
            }},
        };
        try {
            co_await m_ctx.bus.publish(json::serialize(pres));
        } catch (const std::exception&) {}
    }
}

