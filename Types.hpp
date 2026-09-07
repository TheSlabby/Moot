#pragma once

#include <cstdint>
#include <string>
#include <functional>
#include <boost/asio.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/json.hpp>
#include <boost/beast/websocket.hpp>



namespace asio = boost::asio;
namespace beast = boost::beast;
namespace http = beast::http;
namespace websocket = beast::websocket;
namespace json = boost::json;
using tcp = asio::ip::tcp;


struct Session {
    websocket::stream<beast::tcp_stream> ws;
    int64_t     userID {-1};
    std::string username;
};

struct User
{
    int64_t     id;
    std::string username;
};

struct Message
{
    int64_t     id;
    int64_t     channelID;
    int64_t     authorID;
    std::string content;
    std::string authorName;
    int64_t     createdAt {0};
    int64_t     editedAt  {0};  // 0 = never edited
};

struct Guild
{
    int64_t     id;
    std::string name;
    int64_t     ownerID;
};

struct Channel
{
    int64_t     id;
    int64_t     guildID;
    std::string name;
};
