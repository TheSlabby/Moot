#include "Bus.hpp"
#include <algorithm>

std::vector<Bus::Online> Bus::onlineUsers()
{
    std::vector<Online> out;
    for (const auto& s : m_sessions)
    {
        if (auto shared = s.lock())
        {
            if (shared->userID < 0) continue;
            if (std::any_of(out.begin(), out.end(), [&](const Online& o) { return o.id == shared->userID; }))
                continue;
            out.push_back(Online{shared->userID, shared->status, shared->statusText});
        }
    }
    return out;
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
