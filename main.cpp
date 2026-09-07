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
#include "Gateway.hpp"
#include "AppContext.hpp"

namespace asio = boost::asio;
namespace beast = boost::beast;
namespace http = beast::http;
namespace websocket = beast::websocket;
namespace json = boost::json;
using tcp = asio::ip::tcp;


int main(int argc, char* argv[])
{
    // create io ctx
    asio::io_context ioc{1};

    
    Database database("moot.sqlite");
    asio::thread_pool db_pool{1};
    Bus bus;

    // create app context
    AppContext appContext{database, db_pool, bus};

    // gateway (listening tcp socket, creates websocket session)
    Gateway gateway(ioc, 8080, appContext);

    ioc.run();

    return 0;
}