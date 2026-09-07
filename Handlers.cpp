#include "Handlers.hpp"
#include <iostream>
#include <optional>
#include <string>
#include <vector>
#include <unordered_map>
#include <chrono>
#include <random>

namespace Handlers {

static std::string randomToken()
{
    static thread_local std::mt19937_64 rng{std::random_device{}()};
    std::uniform_int_distribution<int> d(0, 15);
    const char* hex = "0123456789abcdef";
    std::string s = "tok-";
    for (int i = 0; i < 24; i++) s += hex[d(rng)];
    return s;
}

// ---- helpers -------------------------------------------------------------
asio::awaitable<void> reply(Session& session, std::string op, json::value d, const json::value& frame)
{
    json::object out{{"op", std::move(op)}, {"d", std::move(d)}};
    if (auto* fo = frame.if_object()) {
        if (auto* r = fo->if_contains("ref")) out["ref"] = *r;
    }
    std::string s = json::serialize(out);
    co_await session.ws.async_write(asio::buffer(s), asio::use_awaitable);
}

static int64_t idOf(const json::value& d, const char* key)
{
    return std::stoll(std::string(d.at(key).as_string()));
}
static std::string strOf(const json::value& d, const char* key)
{
    return std::string(d.at(key).as_string());
}
static int64_t nowMs()
{
    using namespace std::chrono;
    return duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
}

// serialize a Message (reply preview + pinned included when relevant)
static json::object msgJson(const Message& m)
{
    json::object o{
        {"id", std::to_string(m.id)},
        {"channel_id", std::to_string(m.channelID)},
        {"author_id", std::to_string(m.authorID)},
        {"author_name", m.authorName},
        {"content", m.content},
        {"created_at", m.createdAt},
        {"edited_at", m.editedAt},
        {"pinned", m.pinned},
    };
    if (m.replyTo > 0) {
        o["reply_to"] = std::to_string(m.replyTo);
        o["reply_author"] = m.replyAuthor;
        o["reply_content"] = m.replyContent;
    }
    if (!m.attachment.empty()) o["attachment"] = m.attachment;
    return o;
}

// ---- REGISTER (create an account; no real auth yet) ---------------------
asio::awaitable<void> handle_register(Session& session, const json::value& frame, AppContext& ctx)
{
    auto username = strOf(frame.at("d"), "username");
    if (username.empty()) {
        co_await reply(session, "ERROR", json::object{{"code", "bad_username"}, {"message", "username required"}}, frame);
        co_return;
    }
    std::string token = randomToken();
    auto id = co_await asio::co_spawn(ctx.dbPool,
        [ctx, username, token]() -> asio::awaitable<int64_t> {
            int64_t uid = ctx.db.createUser(username, token);
            ctx.db.joinGuild(uid, 10); // land new users in Moot HQ (no-op if it's gone)
            co_return uid;
        }, asio::use_awaitable);

    co_await reply(session, "REGISTERED", json::object{
        {"id", std::to_string(id)},
        {"username", username},
        {"token", token},
    }, frame);
}

// ---- IDENTIFY ------------------------------------------------------------
struct IdentifyResult {
    std::optional<User> user;
    json::array guilds; // each: {id, name, owner_id, channels:[...], members:[...]}
};

asio::awaitable<void> handle_identify(Session& session, const json::value& frame, AppContext& ctx)
{
    std::cout << "HANDLING IDENTIFY" << std::endl;
    auto token = strOf(frame.at("d"), "token");

    auto res = co_await asio::co_spawn(ctx.dbPool,
        [token, ctx]() -> asio::awaitable<IdentifyResult> {
            IdentifyResult r;
            r.user = ctx.db.resolveUser(token);
            if (r.user) {
                for (const auto& g : ctx.db.userGuilds(r.user->id)) {
                    json::array chans;
                    for (const auto& c : ctx.db.guildChannels(g.id))
                        chans.push_back(json::object{{"id", std::to_string(c.id)}, {"name", c.name}});
                    json::array members;
                    for (const auto& u : ctx.db.guildMembers(g.id))
                        members.push_back(json::object{{"id", std::to_string(u.id)}, {"username", u.username}, {"avatar", u.avatar}});
                    r.guilds.push_back(json::object{
                        {"id", std::to_string(g.id)},
                        {"name", g.name},
                        {"owner_id", std::to_string(g.ownerID)},
                        {"icon", g.icon},
                        {"channels", std::move(chans)},
                        {"members", std::move(members)},
                    });
                }
            }
            co_return r;
        }, asio::use_awaitable);

    if (!res.user) {
        co_await reply(session, "ERROR",
            json::object{{"code", "bad_token"}, {"message", "invalid token"}}, frame);
        co_return;
    }

    session.userID = res.user->id;
    session.username = res.user->username;
    session.avatar = res.user->avatar;
    std::cout << "identified " << session.username << " (" << session.userID << ")" << std::endl;

    // who is online right now (includes this session, already subscribed + id set)
    json::array online;
    for (const auto& o : ctx.bus.onlineUsers())
        online.push_back(json::object{
            {"id", std::to_string(o.id)},
            {"status", o.status},
            {"status_text", o.statusText},
        });

    co_await reply(session, "READY", json::object{
        {"session_id", "sess-" + std::to_string(session.userID)},
        {"user", json::object{{"id", std::to_string(session.userID)}, {"username", session.username}, {"avatar", session.avatar}}},
        {"guilds", std::move(res.guilds)},
        {"online", std::move(online)},
    }, frame);

    // tell everyone this user came online
    json::object pres{
        {"op", "PRESENCE"},
        {"d", json::object{
            {"user_id", std::to_string(session.userID)},
            {"username", session.username},
            {"online", true},
            {"status", session.status},
            {"status_text", session.statusText},
        }},
    };
    co_await ctx.bus.publish(json::serialize(pres));
}

// ---- GUILD_CREATE --------------------------------------------------------
asio::awaitable<void> handle_guild_create(Session& session, const json::value& frame, AppContext& ctx)
{
    auto name = strOf(frame.at("d"), "name");
    auto userID = session.userID;

    // create the guild (+ default channel + owner membership) and return the
    // full guild so the client can render it immediately.
    auto guild = co_await asio::co_spawn(ctx.dbPool,
        [userID, ctx, name]() -> asio::awaitable<json::object> {
            int64_t gid = ctx.db.createGuild(userID, name);
            json::array chans;
            for (const auto& c : ctx.db.guildChannels(gid))
                chans.push_back(json::object{{"id", std::to_string(c.id)}, {"name", c.name}});
            json::array members;
            for (const auto& u : ctx.db.guildMembers(gid))
                members.push_back(json::object{{"id", std::to_string(u.id)}, {"username", u.username}});
            co_return json::object{
                {"id", std::to_string(gid)},
                {"name", name},
                {"owner_id", std::to_string(userID)},
                {"icon", ""},
                {"channels", std::move(chans)},
                {"members", std::move(members)},
            };
        }, asio::use_awaitable);

    co_await reply(session, "GUILD_CREATE", guild, frame);
}

// ---- CHANNEL_CREATE ------------------------------------------------------
asio::awaitable<void> handle_channel_create(Session& session, const json::value& frame, AppContext& ctx)
{
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

// ---- MESSAGE_CREATE (persist + broadcast) --------------------------------
asio::awaitable<void> handle_message_create(Session& session, const json::value& frame, AppContext& ctx)
{
    const auto& d = frame.at("d");
    auto channelID = idOf(d, "channel_id");
    auto content = strOf(d, "content");
    auto authorID = session.userID;
    auto authorName = session.username;
    int64_t created = nowMs();

    std::string nonce;
    int64_t replyTo = 0;
    std::string attachment;
    if (auto* dobj = d.if_object()) {
        if (auto* n = dobj->if_contains("nonce")) nonce = std::string(n->as_string());
        if (auto* r = dobj->if_contains("reply_to")) replyTo = std::stoll(std::string(r->as_string()));
        if (auto* a = dobj->if_contains("attachment")) attachment = std::string(a->as_string());
    }

    struct Ins { int64_t id; std::string replyAuthor; std::string replyContent; };
    auto ins = co_await asio::co_spawn(ctx.dbPool,
        [channelID, authorID, ctx, content, created, replyTo, attachment]() -> asio::awaitable<Ins> {
            Ins r;
            r.id = ctx.db.insertMessage(channelID, authorID, content, created, replyTo, attachment);
            if (replyTo > 0) {
                if (auto pm = ctx.db.getMessage(replyTo)) {
                    r.replyAuthor = pm->authorName;
                    r.replyContent = pm->content;
                }
            }
            co_return r;
        }, asio::use_awaitable);

    json::object dj{
        {"id", std::to_string(ins.id)},
        {"channel_id", std::to_string(channelID)},
        {"author_id", std::to_string(authorID)},
        {"author_name", authorName},
        {"content", content},
        {"created_at", created},
        {"nonce", nonce},
    };
    if (replyTo > 0) {
        dj["reply_to"] = std::to_string(replyTo);
        dj["reply_author"] = ins.replyAuthor;
        dj["reply_content"] = ins.replyContent;
    }
    if (!attachment.empty()) dj["attachment"] = attachment;
    json::object event{{"op", "MESSAGE"}, {"d", std::move(dj)}};
    co_await ctx.bus.publish(json::serialize(event));
}

// ---- MESSAGE_EDIT --------------------------------------------------------
asio::awaitable<void> handle_message_edit(Session& session, const json::value& frame, AppContext& ctx)
{
    const auto& d = frame.at("d");
    auto messageID = idOf(d, "message_id");
    auto channelId = strOf(d, "channel_id");
    auto content = strOf(d, "content");
    auto authorID = session.userID;
    int64_t edited = nowMs();

    bool ok = co_await asio::co_spawn(ctx.dbPool,
        [messageID, authorID, ctx, content, edited]() -> asio::awaitable<bool> {
            co_return ctx.db.editMessage(messageID, authorID, content, edited);
        }, asio::use_awaitable);

    if (ok) {
        json::object event{
            {"op", "MESSAGE_UPDATE"},
            {"d", json::object{
                {"id", std::to_string(messageID)},
                {"channel_id", channelId},
                {"content", content},
                {"edited_at", edited},
            }},
        };
        co_await ctx.bus.publish(json::serialize(event));
    }
}

// ---- MESSAGE_DELETE ------------------------------------------------------
asio::awaitable<void> handle_message_delete(Session& session, const json::value& frame, AppContext& ctx)
{
    const auto& d = frame.at("d");
    auto messageID = idOf(d, "message_id");
    auto channelId = strOf(d, "channel_id");
    auto authorID = session.userID;

    bool ok = co_await asio::co_spawn(ctx.dbPool,
        [messageID, authorID, ctx]() -> asio::awaitable<bool> {
            co_return ctx.db.deleteMessage(messageID, authorID);
        }, asio::use_awaitable);

    if (ok) {
        json::object event{
            {"op", "MESSAGE_DELETE"},
            {"d", json::object{{"id", std::to_string(messageID)}, {"channel_id", channelId}}},
        };
        co_await ctx.bus.publish(json::serialize(event));
    }
}

// ---- REACTION_ADD / REACTION_REMOVE --------------------------------------
static asio::awaitable<void> reaction(Session& session, const json::value& frame, AppContext& ctx, bool add)
{
    const auto& d = frame.at("d");
    auto messageID = idOf(d, "message_id");
    auto channelId = strOf(d, "channel_id");
    auto emoji = strOf(d, "emoji");
    auto userID = session.userID;

    bool changed = co_await asio::co_spawn(ctx.dbPool,
        [messageID, userID, ctx, emoji, add]() -> asio::awaitable<bool> {
            co_return add ? ctx.db.addReaction(messageID, userID, emoji)
                          : ctx.db.removeReaction(messageID, userID, emoji);
        }, asio::use_awaitable);

    if (!changed) co_return;  // no-op (already reacted / not reacted) — don't broadcast

    json::object event{
        {"op", "REACTION_UPDATE"},
        {"d", json::object{
            {"message_id", std::to_string(messageID)},
            {"channel_id", channelId},
            {"emoji", emoji},
            {"user_id", std::to_string(userID)},
            {"added", add},
        }},
    };
    co_await ctx.bus.publish(json::serialize(event));
}
asio::awaitable<void> handle_reaction_add(Session& session, const json::value& frame, AppContext& ctx)
{ co_await reaction(session, frame, ctx, true); }
asio::awaitable<void> handle_reaction_remove(Session& session, const json::value& frame, AppContext& ctx)
{ co_await reaction(session, frame, ctx, false); }

// ---- TYPING (ephemeral, no DB) -------------------------------------------
asio::awaitable<void> handle_typing(Session& session, const json::value& frame, AppContext& ctx)
{
    auto channelId = strOf(frame.at("d"), "channel_id");
    json::object event{
        {"op", "TYPING"},
        {"d", json::object{
            {"channel_id", channelId},
            {"user_id", std::to_string(session.userID)},
            {"username", session.username},
        }},
    };
    co_await ctx.bus.publish(json::serialize(event));
}

// ---- USER_UPDATE (rename yourself) ---------------------------------------
asio::awaitable<void> handle_user_update(Session& session, const json::value& frame, AppContext& ctx)
{
    auto username = strOf(frame.at("d"), "username");
    if (username.empty()) co_return;
    auto userID = session.userID;

    co_await asio::co_spawn(ctx.dbPool,
        [userID, ctx, username]() -> asio::awaitable<void> {
            ctx.db.updateUsername(userID, username);
            co_return;
        }, asio::use_awaitable);

    session.username = username;

    json::object event{
        {"op", "USER_UPDATE"},
        {"d", json::object{
            {"user_id", std::to_string(userID)},
            {"username", username},
            {"avatar", session.avatar},
        }},
    };
    co_await ctx.bus.publish(json::serialize(event));
}

// ---- SET_AVATAR ----------------------------------------------------------
asio::awaitable<void> handle_set_avatar(Session& session, const json::value& frame, AppContext& ctx)
{
    auto url = strOf(frame.at("d"), "url");
    auto userID = session.userID;
    co_await asio::co_spawn(ctx.dbPool,
        [userID, ctx, url]() -> asio::awaitable<void> { ctx.db.setAvatar(userID, url); co_return; },
        asio::use_awaitable);
    session.avatar = url;

    json::object event{
        {"op", "USER_UPDATE"},
        {"d", json::object{
            {"user_id", std::to_string(userID)},
            {"username", session.username},
            {"avatar", url},
        }},
    };
    co_await ctx.bus.publish(json::serialize(event));
}

// ---- SET_GUILD_ICON ------------------------------------------------------
asio::awaitable<void> handle_set_guild_icon(Session& session, const json::value& frame, AppContext& ctx)
{
    (void)session;
    const auto& d = frame.at("d");
    auto guildID = idOf(d, "guild_id");
    auto url = strOf(d, "url");
    co_await asio::co_spawn(ctx.dbPool,
        [guildID, ctx, url]() -> asio::awaitable<void> { ctx.db.setGuildIcon(guildID, url); co_return; },
        asio::use_awaitable);

    json::object event{
        {"op", "GUILD_UPDATE"},
        {"d", json::object{
            {"guild_id", std::to_string(guildID)},
            {"icon", url},
        }},
    };
    co_await ctx.bus.publish(json::serialize(event));
}

// ---- SET_STATUS ----------------------------------------------------------
asio::awaitable<void> handle_set_status(Session& session, const json::value& frame, AppContext& ctx)
{
    const auto& d = frame.at("d");
    session.status = strOf(d, "status");
    session.statusText.clear();
    if (auto* o = d.if_object())
        if (auto* t = o->if_contains("status_text")) session.statusText = std::string(t->as_string());

    json::object pres{
        {"op", "PRESENCE"},
        {"d", json::object{
            {"user_id", std::to_string(session.userID)},
            {"username", session.username},
            {"online", true},
            {"status", session.status},
            {"status_text", session.statusText},
        }},
    };
    co_await ctx.bus.publish(json::serialize(pres));
}

// ---- PIN / UNPIN ---------------------------------------------------------
static asio::awaitable<void> pinSet(Session& session, const json::value& frame, AppContext& ctx, bool pin)
{
    (void)session;
    const auto& d = frame.at("d");
    auto messageID = idOf(d, "message_id");
    auto channelId = strOf(d, "channel_id");

    co_await asio::co_spawn(ctx.dbPool,
        [messageID, ctx, pin]() -> asio::awaitable<void> {
            ctx.db.setPinned(messageID, pin);
            co_return;
        }, asio::use_awaitable);

    json::object event{
        {"op", "PIN_UPDATE"},
        {"d", json::object{
            {"message_id", std::to_string(messageID)},
            {"channel_id", channelId},
            {"pinned", pin},
        }},
    };
    co_await ctx.bus.publish(json::serialize(event));
}
asio::awaitable<void> handle_pin(Session& s, const json::value& f, AppContext& c) { co_await pinSet(s, f, c, true); }
asio::awaitable<void> handle_unpin(Session& s, const json::value& f, AppContext& c) { co_await pinSet(s, f, c, false); }

// ---- GET_PINS ------------------------------------------------------------
asio::awaitable<void> handle_get_pins(Session& session, const json::value& frame, AppContext& ctx)
{
    auto channelID = idOf(frame.at("d"), "channel_id");
    auto arr = co_await asio::co_spawn(ctx.dbPool,
        [channelID, ctx]() -> asio::awaitable<json::array> {
            json::array out;
            for (const auto& m : ctx.db.pinnedMessages(channelID)) out.push_back(msgJson(m));
            co_return out;
        }, asio::use_awaitable);

    co_await reply(session, "PINS", json::object{
        {"channel_id", std::to_string(channelID)},
        {"messages", std::move(arr)},
    }, frame);
}

// ---- HISTORY -------------------------------------------------------------
asio::awaitable<void> handle_history(Session& session, const json::value& frame, AppContext& ctx)
{
    const auto& d = frame.at("d");
    auto channelID = idOf(d, "channel_id");
    auto me = session.userID;

    int64_t before = INT64_MAX;
    if (auto* dobj = d.if_object())
        if (auto* b = dobj->if_contains("before")) before = std::stoll(std::string(b->as_string()));
    int limit = static_cast<int>(d.at("limit").to_number<int64_t>());

    auto arr = co_await asio::co_spawn(ctx.dbPool,
        [channelID, before, limit, me, ctx]() -> asio::awaitable<json::array> {
            auto msgs = ctx.db.messagesBefore(channelID, before, limit);
            auto reacts = ctx.db.reactionsForChannel(channelID, me);

            std::unordered_map<int64_t, json::array> byMsg;
            for (const auto& r : reacts)
                byMsg[r.messageID].push_back(json::object{
                    {"emoji", r.emoji}, {"count", r.count}, {"me", r.me}});

            json::array out;
            for (const auto& m : msgs) {
                auto it = byMsg.find(m.id);
                json::object o = msgJson(m);
                o["reactions"] = it != byMsg.end() ? it->second : json::array{};
                out.push_back(std::move(o));
            }
            co_return out;
        }, asio::use_awaitable);

    co_await reply(session, "HISTORY", json::object{
        {"channel_id", std::to_string(channelID)},
        {"messages", std::move(arr)},
    }, frame);
}

// ---- HEARTBEAT -----------------------------------------------------------
asio::awaitable<void> handle_heartbeat(Session& session, const json::value& frame, AppContext& ctx)
{
    (void)ctx;
    co_await reply(session, "HEARTBEAT_ACK", json::object{}, frame);
}

} // namespace Handlers
