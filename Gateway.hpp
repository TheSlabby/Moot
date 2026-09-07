#pragma once

#include "Types.hpp"
#include "AppContext.hpp"

class Gateway
{
public:
    Gateway(asio::io_context& ioc, uint16_t listenPort, AppContext& ctx);

private:
    asio::io_context& m_ioc;
    AppContext& m_ctx;

    asio::awaitable<void> listen(uint16_t listenPort);
    asio::awaitable<void> handle_connection(tcp::socket socket);
    asio::awaitable<void> handle_websocket(beast::tcp_stream stream, http::request<http::string_body> req);
    asio::awaitable<void> handle_http(beast::tcp_stream stream, http::request<http::string_body> req);
};
