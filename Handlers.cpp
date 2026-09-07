#include "Handlers.hpp"
#include <iostream>
#include <optional>
#include <string>
#include <vector>

namespace Handlers {

// ---- shared reply helper -------------------------------------------------
// Build {op, d}, echo the request's ref if it had one, serialize, write.
asio::awaitable<void> reply(Session& session, std::string op, json::value d, const json::value& frame)
{
    json::object out{{"op", std::move(op)}, {"d", std::move(d)}};
    if (auto* fo = frame.if_object()) {
        if (auto* r = fo->if_contains("ref")) out["ref"] = *r;
    }
    std::string s = json::serialize(out);
    co_await session.ws.async_write(asio::buffer(s), asio::use_awaitable);
}

// small helpers for the string<->int64 id boundary
static int64_t idOf(const json::value& d, const char* key)
{
    return std::stoll(std::string(d.at(key).as_string()));
}
static std::string strOf(const json::value& d, const char* key)
{
    return std::string(d.at(key).as_string());
}

// ---- IDENTIFY ------------------------------------------------------------
asio::awaitable<void> handle_identify(Session& session, const json::value& frame, AppContext& ctx)
{
    std::cout << "HANDLING IDENTIFY" << std::endl;
    auto token = strOf(frame.at("d"), "token");

    auto userID = co_await asio::co_spawn(ctx.dbPool,
        [token, ctx]() -> asio::awaitable<std::optional<int64_t>> {
            co_return ctx.db.resolveToken(token);
        }, asio::use_awaitable);

    if (userID) {
        session.userID = *userID;
        std::cout << "resolved token: " << token << " -> " << *userID << std::endl;
        co_await reply(session, "READY", json::object{
            {"session_id", "sess-" + std::to_string(*userID)},
            {"user", json::object{{"id", std::to_string(*userID)}}},
        }, frame);
    } else {
        std::cerr << "couldn't resolve token: " << token << std::endl;
        co_await reply(session, "ERROR",
            json::object{{"code", "bad_token"}, {"message", "invalid token"}}, frame);
    }
}

// ---- GUILD_CREATE --------------------------------------------------------
asio::awaitable<void> handle_guild_create(Session& session, const json::value& frame, AppContext& ctx)
{
    std::cout << "HANDLING GUILD_CREATE" << std::endl;
    auto name = strOf(frame.at("d"), "name");
    auto userID = session.userID;

    auto guildID = co_await asio::co_spawn(ctx.dbPool,
        [userID, ctx, name]() -> asio::awaitable<int64_t> {
            co_return ctx.db.createGuild(userID, name);
        }, asio::use_awaitable);

    co_await reply(session, "GUILD_CREATE", json::object{
        {"id", std::to_string(guildID)},
        {"name", name},
        {"owner_id", std::to_string(userID)},
    }, frame);
}

// ---- CHANNEL_CREATE ------------------------------------------------------
asio::awaitable<void> handle_channel_create(Session& session, const json::value& frame, AppContext& ctx)
{
    std::cout << "HANDLING CHANNEL_CREATE" << std::endl;
    auto guildID = idOf(frame.at("d"), "guild_id");
    auto name = strOf(frame.at("d"), "name");

    auto channelID = co_await asio::co_spawn(ctx.dbPool,
        [guildID, ctx, name]() -> asio::awaitable<int64_t> {
            co_return ctx.db.createChannel(guildID, name);
        }, asio::use_awaitable);

    co_await reply(session, "CHANNEL_CREATE", json::object{
        {"id", std::to_string(channelID)},
        {"guild_id", std::to_string(guildID)},
        {"name", name},
    }, frame);
}

// ---- GUILD_JOIN ----------------------------------------------------------
asio::awaitable<void> handle_guild_join(Session& session, const json::value& frame, AppContext& ctx)
{
    std::cout << "HANDLING GUILD_JOIN" << std::endl;
    auto guildID = idOf(frame.at("d"), "guild_id");
    auto userID = session.userID;

    co_await asio::co_spawn(ctx.dbPool,
        [userID, guildID, ctx]() -> asio::awaitable<void> {
            ctx.db.joinGuild(userID, guildID);
            co_return;
        }, asio::use_awaitable);

    co_await reply(session, "GUILD_JOIN", json::object{
        {"guild_id", std::to_string(guildID)},
        {"status", "ok"},
    }, frame);
}

// ---- MESSAGE_CREATE (unusual: persist, then broadcast an event) ----------
asio::awaitable<void> handle_message_create(Session& session, const json::value& frame, AppContext& ctx)
{
    std::cout << "HANDLING MESSAGE_CREATE" << std::endl;
    const auto& d = frame.at("d");
    auto channelID = idOf(d, "channel_id");
    auto content = strOf(d, "content");
    auto authorID = session.userID;

    std::string nonce;
    if (auto* dobj = d.if_object()) {
        if (auto* n = dobj->if_contains("nonce")) nonce = std::string(n->as_string());
    }

    auto msgID = co_await asio::co_spawn(ctx.dbPool,
        [channelID, authorID, ctx, content]() -> asio::awaitable<int64_t> {
            co_return ctx.db.insertMessage(channelID, authorID, content);
        }, asio::use_awaitable);

    // Broadcast a MESSAGE event to all sessions (no ref — it's an event).
    json::object event{
        {"op", "MESSAGE"},
        {"d", json::object{
            {"id", std::to_string(msgID)},
            {"channel_id", std::to_string(channelID)},
            {"author_id", std::to_string(authorID)},
            {"content", content},
            {"nonce", nonce},
        }},
    };
    co_await ctx.bus.publish(json::serialize(event));
}

// ---- HISTORY (read) ------------------------------------------------------
asio::awaitable<void> handle_history(Session& session, const json::value& frame, AppContext& ctx)
{
    std::cout << "HANDLING HISTORY" << std::endl;
    const auto& d = frame.at("d");
    auto channelID = idOf(d, "channel_id");

    int64_t before = INT64_MAX;
    if (auto* dobj = d.if_object()) {
        if (auto* b = dobj->if_contains("before"))
            before = std::stoll(std::string(b->as_string()));
    }
    int limit = static_cast<int>(d.at("limit").to_number<int64_t>());

    auto messages = co_await asio::co_spawn(ctx.dbPool,
        [channelID, before, limit, ctx]() -> asio::awaitable<std::vector<Message>> {
            co_return ctx.db.messagesBefore(channelID, before, limit);
        }, asio::use_awaitable);

    json::array arr;
    for (const auto& m : messages) {
        arr.push_back(json::object{
            {"id", std::to_string(m.id)},
            {"channel_id", std::to_string(m.channelID)},
            {"author_id", std::to_string(m.authorID)},
            {"content", m.content},
        });
    }

    co_await reply(session, "HISTORY", json::object{
        {"channel_id", std::to_string(channelID)},
        {"messages", std::move(arr)},
    }, frame);
}

// ---- HEARTBEAT (no DB, no pool hop) --------------------------------------
asio::awaitable<void> handle_heartbeat(Session& session, const json::value& frame, AppContext& ctx)
{
    (void)ctx;
    co_await reply(session, "HEARTBEAT_ACK", json::object{}, frame);
}

} // namespace Handlers
