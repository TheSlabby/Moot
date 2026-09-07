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
    std::optional<User> resolveUser(const std::string& token);  // token -> {id, username}

    // profile
    void updateUsername(int64_t userID, const std::string& username);
    void setAvatar(int64_t userID, const std::string& url);
    void setGuildIcon(int64_t guildID, const std::string& url);

    // creates
    int64_t createUser(const std::string& username, const std::string& token);
    int64_t createGuild(int64_t ownerID, const std::string& name);
    int64_t createChannel(int64_t guildID, const std::string& name);
    int64_t insertMessage(int64_t channelID, int64_t authorID, const std::string& content, int64_t createdAtMs, int64_t replyTo, const std::string& attachment);

    // edit / delete (author-scoped; returns whether a row changed)
    bool editMessage(int64_t messageID, int64_t authorID, const std::string& content, int64_t editedAtMs);
    bool deleteMessage(int64_t messageID, int64_t authorID);

    // pins (anyone in the guild may pin/unpin)
    void setPinned(int64_t messageID, bool pinned);
    std::vector<Message> pinnedMessages(int64_t channelID);

    // one message with its author name (for reply previews)
    std::optional<Message> getMessage(int64_t messageID);

    // reactions (return whether a row actually changed)
    bool addReaction(int64_t messageID, int64_t userID, const std::string& emoji);
    bool removeReaction(int64_t messageID, int64_t userID, const std::string& emoji);

    // membership
    void joinGuild(int64_t userID, int64_t guildID);

    // reads
    std::vector<Message> messagesBefore(int64_t channelID, int64_t beforeID, int limit);
    std::vector<Guild>   userGuilds(int64_t userID);      // guilds the user is a member of
    std::vector<Channel> guildChannels(int64_t guildID);  // channels in a guild
    std::vector<User>    guildMembers(int64_t guildID);   // members of a guild

    // reaction summary rows for a channel (one per message+emoji)
    struct ReactionRow { int64_t messageID; std::string emoji; int count; bool me; };
    std::vector<ReactionRow> reactionsForChannel(int64_t channelID, int64_t meUserID);

private:
    SQLite::Database m_db;
};
