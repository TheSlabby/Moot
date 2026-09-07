#pragma once

#include "Types.hpp"
#include "AppContext.hpp"

using Handler = std::function<asio::awaitable<void>(Session&, const json::value&, AppContext& appContext)>;

namespace Handlers {

asio::awaitable<void> handle_identify(Session& session, const json::value&, AppContext& appContext);
asio::awaitable<void> handle_guild_create(Session& session, const json::value&, AppContext& appContext);




// DISPATCH MAP
inline std::unordered_map<std::string, Handler> dispatchMap = {
    {"IDENTIFY", handle_identify},
    {"GUILD_CREATE", handle_guild_create},
};


} // Handlers namespace
