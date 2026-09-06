#pragma once

#include <SQLiteCpp/SQLiteCpp.h>
#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include "Types.hpp"

class Database
{
public:
    Database(const std::string& file);

    // authentication (super basic token for now)
    bool verifyToken(int64_t userID, const std::string& token);
    std::optional<int64_t> resolveToken(const std::string& token);

    // creates
    int64_t createUser(const std::string& username, const std::string& token);
    int64_t createGuild(int64_t ownerID, const std::string& name);
    int64_t createChannel(int64_t guildID, const std::string& name);
    int64_t insertMessage(int64_t channelID, int64_t authorID, const std::string& content);

    // membership
    void joinGuild(int64_t userID, int64_t guildID);

    // reads
    std::vector<Message> messagesBefore(int64_t channelID, int64_t beforeID, int limit);

private:
    SQLite::Database m_db;
};
