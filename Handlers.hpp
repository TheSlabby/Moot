#pragma once

#include "Types.hpp"
#include "AppContext.hpp"

// Handlers receive the whole frame (not just `d`) so they can echo `ref`.
using Handler = std::function<asio::awaitable<void>(Session&, const json::value& frame, AppContext&)>;

namespace Handlers {

// Serialize {op, d} (echoing frame's ref if present) and write it to the client.
asio::awaitable<void> reply(Session& session, std::string op, json::value d, const json::value& frame);

asio::awaitable<void> handle_identify(Session& session, const json::value& frame, AppContext& ctx);
asio::awaitable<void> handle_guild_create(Session& session, const json::value& frame, AppContext& ctx);
asio::awaitable<void> handle_channel_create(Session& session, const json::value& frame, AppContext& ctx);
asio::awaitable<void> handle_guild_join(Session& session, const json::value& frame, AppContext& ctx);
asio::awaitable<void> handle_message_create(Session& session, const json::value& frame, AppContext& ctx);
asio::awaitable<void> handle_message_edit(Session& session, const json::value& frame, AppContext& ctx);
asio::awaitable<void> handle_message_delete(Session& session, const json::value& frame, AppContext& ctx);
asio::awaitable<void> handle_reaction_add(Session& session, const json::value& frame, AppContext& ctx);
asio::awaitable<void> handle_reaction_remove(Session& session, const json::value& frame, AppContext& ctx);
asio::awaitable<void> handle_typing(Session& session, const json::value& frame, AppContext& ctx);
asio::awaitable<void> handle_user_update(Session& session, const json::value& frame, AppContext& ctx);
asio::awaitable<void> handle_history(Session& session, const json::value& frame, AppContext& ctx);
asio::awaitable<void> handle_heartbeat(Session& session, const json::value& frame, AppContext& ctx);

// DISPATCH MAP
inline std::unordered_map<std::string, Handler> dispatchMap = {
    {"IDENTIFY", handle_identify},
    {"GUILD_CREATE", handle_guild_create},
    {"CHANNEL_CREATE", handle_channel_create},
    {"GUILD_JOIN", handle_guild_join},
    {"MESSAGE_CREATE", handle_message_create},
    {"MESSAGE_EDIT", handle_message_edit},
    {"MESSAGE_DELETE", handle_message_delete},
    {"REACTION_ADD", handle_reaction_add},
    {"REACTION_REMOVE", handle_reaction_remove},
    {"TYPING", handle_typing},
    {"USER_UPDATE", handle_user_update},
    {"HISTORY", handle_history},
    {"HEARTBEAT", handle_heartbeat},
};

} // namespace Handlers
