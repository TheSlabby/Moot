#pragma once

#include "Types.hpp"
#include "AppContext.hpp"

// Handlers now receive the whole frame (not just `d`) so they can echo `ref`.
using Handler = std::function<asio::awaitable<void>(Session&, const json::value& frame, AppContext&)>;

namespace Handlers {

// Serialize {op, d} (echoing frame's ref if present) and write it to the client.
asio::awaitable<void> reply(Session& session, std::string op, json::value d, const json::value& frame);

asio::awaitable<void> handle_identify(Session& session, const json::value& frame, AppContext& ctx);
asio::awaitable<void> handle_guild_create(Session& session, const json::value& frame, AppContext& ctx);
asio::awaitable<void> handle_channel_create(Session& session, const json::value& frame, AppContext& ctx);
asio::awaitable<void> handle_guild_join(Session& session, const json::value& frame, AppContext& ctx);
asio::awaitable<void> handle_message_create(Session& session, const json::value& frame, AppContext& ctx);
asio::awaitable<void> handle_history(Session& session, const json::value& frame, AppContext& ctx);
asio::awaitable<void> handle_heartbeat(Session& session, const json::value& frame, AppContext& ctx);

// DISPATCH MAP
inline std::unordered_map<std::string, Handler> dispatchMap = {
    {"IDENTIFY", handle_identify},
    {"GUILD_CREATE", handle_guild_create},
    {"CHANNEL_CREATE", handle_channel_create},
    {"GUILD_JOIN", handle_guild_join},
    {"MESSAGE_CREATE", handle_message_create},
    {"HISTORY", handle_history},
    {"HEARTBEAT", handle_heartbeat},
};

} // namespace Handlers
