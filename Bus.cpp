#include "Bus.hpp"

asio::awaitable<void> Bus::publish(const std::string& msg)
{
    // TODO: serial writes block on the slowest client; replace with per-session
    // outboxes so one slow connection can't stall the whole broadcast.
    for (const auto& s : m_sessions)
    {
        if (auto shared = s.lock())
        {
            shared->ws.text(true);
            co_await shared->ws.async_write(asio::buffer(msg), asio::use_awaitable);
        }
    }
}
