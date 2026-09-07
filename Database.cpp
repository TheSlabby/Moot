#include "Database.hpp"
#include "Schema.hpp"

Database::Database(const std::string& file) :
    m_db(file, SQLite::OPEN_READWRITE | SQLite::OPEN_CREATE)
{
    m_db.exec("PRAGMA journal_mode = WAL");
    m_db.exec("PRAGMA synchronous  = NORMAL");
    m_db.exec("PRAGMA foreign_keys = ON");
    m_db.exec("PRAGMA busy_timeout = 5000");

    // Create tables if they don't exist yet.
    m_db.exec(SCHEMA_SQL);
}

// authentication
bool Database::verifyToken(int64_t userID, const std::string& token)
{
    SQLite::Statement stmt(m_db, "SELECT 1 FROM users WHERE id = ? AND token = ?");
    stmt.bind(1, userID);
    stmt.bind(2, token);
    return stmt.executeStep();
}
std::optional<int64_t> Database::resolveToken(const std::string& token)
{
    SQLite::Statement stmt(m_db, "SELECT id FROM users WHERE token = ?");
    stmt.bind(1, token);
    if (stmt.executeStep())
        return stmt.getColumn(0).getInt64();
    return std::nullopt;
}

// creates
int64_t Database::createUser(const std::string& username, const std::string& token)
{
    SQLite::Statement stmt(m_db, "INSERT INTO users(username, token) VALUES (?, ?)");
    stmt.bind(1, username);
    stmt.bind(2, token);
    stmt.exec();
    return m_db.getLastInsertRowid();
}

int64_t Database::createGuild(int64_t ownerID, const std::string& name)
{
    // transaction so we can roll back
    SQLite::Transaction txn(m_db, SQLite::TransactionBehavior::IMMEDIATE);

    SQLite::Statement gstmt(m_db, "INSERT INTO guilds(name, owner_id) VALUES (?, ?)");
    gstmt.bind(1, name);
    gstmt.bind(2, ownerID);
    gstmt.exec();
    int64_t guildID = m_db.getLastInsertRowid();

    SQLite::Statement mstmt(m_db, "INSERT INTO memberships(guild_id, user_id) VALUES (?, ?)");
    mstmt.bind(1, guildID);
    mstmt.bind(2, ownerID);
    mstmt.exec();

    txn.commit();
    return guildID;
}

int64_t Database::createChannel(int64_t guildID, const std::string& name)
{
    SQLite::Statement stmt(m_db, "INSERT INTO channels(guild_id, name) VALUES (?, ?)");
    stmt.bind(1, guildID);
    stmt.bind(2, name);
    stmt.exec();
    return m_db.getLastInsertRowid();
}

int64_t Database::insertMessage(int64_t channelID, int64_t authorID, const std::string& content)
{
    SQLite::Statement stmt(m_db,
        "INSERT INTO messages(channel_id, author_id, content) VALUES (?, ?, ?)");
    stmt.bind(1, channelID);
    stmt.bind(2, authorID);
    stmt.bind(3, content);
    stmt.exec();
    return m_db.getLastInsertRowid();
}

// --- membership ---

void Database::joinGuild(int64_t userID, int64_t guildID)
{
    SQLite::Statement stmt(m_db,
        "INSERT OR IGNORE INTO memberships(guild_id, user_id) VALUES (?, ?)");
    stmt.bind(1, guildID);
    stmt.bind(2, userID);
    stmt.exec();
}

// --- reads ---

std::vector<Message> Database::messagesBefore(int64_t channelID, int64_t beforeID, int limit)
{
    SQLite::Statement stmt(m_db,
        "SELECT id, channel_id, author_id, content FROM messages "
        "WHERE channel_id = ? AND id < ? ORDER BY id DESC LIMIT ?");
    stmt.bind(1, channelID);
    stmt.bind(2, beforeID);
    stmt.bind(3, limit);

    std::vector<Message> out;
    while (stmt.executeStep())
    {
        Message m;
        m.id        = stmt.getColumn(0).getInt64();
        m.channelID = stmt.getColumn(1).getInt64();
        m.authorID  = stmt.getColumn(2).getInt64();
        m.content   = stmt.getColumn(3).getString();
        out.push_back(std::move(m));
    }
    return out;
}

std::vector<Guild> Database::userGuilds(int64_t userID)
{
    SQLite::Statement stmt(m_db,
        "SELECT g.id, g.name, g.owner_id FROM guilds g "
        "JOIN memberships m ON m.guild_id = g.id "
        "WHERE m.user_id = ? ORDER BY g.id");
    stmt.bind(1, userID);

    std::vector<Guild> out;
    while (stmt.executeStep())
    {
        Guild g;
        g.id      = stmt.getColumn(0).getInt64();
        g.name    = stmt.getColumn(1).getString();
        g.ownerID = stmt.getColumn(2).getInt64();
        out.push_back(std::move(g));
    }
    return out;
}

std::vector<Channel> Database::guildChannels(int64_t guildID)
{
    SQLite::Statement stmt(m_db,
        "SELECT id, guild_id, name FROM channels WHERE guild_id = ? ORDER BY id");
    stmt.bind(1, guildID);

    std::vector<Channel> out;
    while (stmt.executeStep())
    {
        Channel c;
        c.id      = stmt.getColumn(0).getInt64();
        c.guildID = stmt.getColumn(1).getInt64();
        c.name    = stmt.getColumn(2).getString();
        out.push_back(std::move(c));
    }
    return out;
}
