#include "Handlers.hpp"
#include <iostream>

namespace Handlers {

asio::awaitable<void> handle_identify(Session& session, const json::value& v, AppContext& appContext)
{
    std::cout << "HANDLING IDENTIFY" << std::endl;
    auto token = std::string(v.at("token").as_string());

    // GO TO DB THREAD (resume back on the session's strand)
    auto userID = co_await asio::co_spawn(appContext.dbPool, [token, appContext]() -> asio::awaitable<std::optional<int64_t>> {
        co_return appContext.db.resolveToken(token);
    }, asio::use_awaitable);

    // Send text frames (JSON), not binary.
    session.ws.text(true);

    if (userID) {
        session.userID = *userID;
        std::cout << "resolved token: " << token << " -> " << *userID << std::endl;

        // send READY message
        json::object ready{
            {"op", "READY"},
            {"d", {
                {"session_id", "sess-" + std::to_string(*userID)},
                {"user", {{"id", std::to_string(*userID)}}}
            }}
        };
        std::string out = json::serialize(ready);
        co_await session.ws.async_write(asio::buffer(out), asio::use_awaitable);
    } else {
        std::cerr << "couldn't resolve token: " << token << std::endl;

        json::object err{
            {"op", "ERROR"},
            {"d", {{"code", "bad_token"}, {"message", "invalid token"}}}
        };
        std::string out = json::serialize(err);
        co_await session.ws.async_write(asio::buffer(out), asio::use_awaitable);
    }

    co_return;
}

asio::awaitable<void> handle_guild_create(Session& session, const json::value& v, AppContext& appContext)
{
    std::cout << "HANDLING GUILD CREATION" << std::endl;
    auto name = std::string(v.at("name").as_string());
    auto userID = session.userID;

    auto guildID = co_await asio::co_spawn(appContext.dbPool, [userID, appContext, name]() -> asio::awaitable<int64_t> {
        co_return appContext.db.createGuild(userID, name);
    }, asio::use_awaitable);

    co_return;
}


} // Handlers namespace
