#pragma once

#include "Database.hpp"
#include "Bus.hpp"
#include <boost/asio.hpp>

struct AppContext
{
    Database& db;
    asio::thread_pool& dbPool;
    Bus& bus;
};
