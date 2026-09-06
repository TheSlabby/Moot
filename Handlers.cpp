#include "Handlers.hpp"
#include <iostream>

namespace Handlers {

asio::awaitable<void> handle_identify(Session& session, const json::value& v, AppContext& appContext)
{
    std::cout << "HANDLING IDENTIFY" << std::endl;
    auto token = std::string(v.at("token").as_string());
    auto here = session.ws.get_executor();

    // GO TO DB THREAD
    auto userID = co_await asio::co_spawn(appContext.dbPool, [token, appContext]() -> asio::awaitable<std::optional<int64_t>> {
        co_return appContext.db.resolveToken(token);
    }, asio::use_awaitable);

    if (userID) {
        session.userID = *userID;
        std::cout << "resolved token: " << token << " -> " << *userID << std::endl;
    } else {
        std::cerr << "couldn't resolve token: " << token << std::endl;
    }

    co_return;
}

} // Handlers namespace
