#include "Bus.hpp"
#include <algorithm>

std::vector<int64_t> Bus::onlineUserIds()
{
    std::vector<int64_t> ids;
    for (const auto& s : m_sessions)
    {
        if (auto shared = s.lock())
        {
            if (shared->userID >= 0 &&
                std::find(ids.begin(), ids.end(), shared->userID) == ids.end())
                ids.push_back(shared->userID);
        }
    }
    return ids;
}

asio::awaitable<void> Bus::publish(const std::string& msg)
{
    // TODO: serial writes block on the slowest client; replace with per-session
    // outboxes so one slow connection can't stall the whole broadcast.
    for (const auto& s : m_sessions)
    {
        if (auto shared = s.lock())
        {
            try {
                shared->ws.text(true);
                co_await shared->ws.async_write(asio::buffer(msg), asio::use_awaitable);
            } catch (const std::exception&) {
                // dead/slow socket — skip it, don't stall the rest of the fanout
            }
        }
    }
}
