#pragma once

#include "Types.hpp"
#include <vector>
#include <memory>
#include <cstdint>

// Holds the active sessions and fans a frame out to all of them.
// (Simple broadcast-to-all for now; per-channel topics + outbox come later.)
class Bus
{
public:
    // Register a session to receive published frames. Non-owning (weak_ptr),
    // so a session dies when its connection ends, not when the Bus lets go.
    void subscribe(std::weak_ptr<Session> session) { m_sessions.push_back(std::move(session)); }

    // Send a frame to every live session.
    asio::awaitable<void> publish(const std::string& msg);

    // Currently-connected, identified users with their status.
    struct Online { int64_t id; std::string status; std::string statusText; };
    std::vector<Online> onlineUsers();

private:
    std::vector<std::weak_ptr<Session>> m_sessions;
};
