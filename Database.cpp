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
std::optional<User> Database::resolveUser(const std::string& token)
{
    SQLite::Statement stmt(m_db, "SELECT id, username FROM users WHERE token = ?");
    stmt.bind(1, token);
    if (stmt.executeStep())
        return User{stmt.getColumn(0).getInt64(), stmt.getColumn(1).getString()};
    return std::nullopt;
}

// profile
void Database::updateUsername(int64_t userID, const std::string& username)
{
    SQLite::Statement stmt(m_db, "UPDATE users SET username = ? WHERE id = ?");
    stmt.bind(1, username);
    stmt.bind(2, userID);
    stmt.exec();
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
    // guild + owner membership + a default channel, all atomic
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

    SQLite::Statement cstmt(m_db, "INSERT INTO channels(guild_id, name) VALUES (?, 'general')");
    cstmt.bind(1, guildID);
    cstmt.exec();

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

int64_t Database::insertMessage(int64_t channelID, int64_t authorID, const std::string& content, int64_t createdAtMs)
{
    SQLite::Statement stmt(m_db,
        "INSERT INTO messages(channel_id, author_id, content, created_at) VALUES (?, ?, ?, ?)");
    stmt.bind(1, channelID);
    stmt.bind(2, authorID);
    stmt.bind(3, content);
    stmt.bind(4, createdAtMs);
    stmt.exec();
    return m_db.getLastInsertRowid();
}

// --- edit / delete (author-scoped) ---

bool Database::editMessage(int64_t messageID, int64_t authorID, const std::string& content, int64_t editedAtMs)
{
    SQLite::Statement stmt(m_db,
        "UPDATE messages SET content = ?, edited_at = ? WHERE id = ? AND author_id = ?");
    stmt.bind(1, content);
    stmt.bind(2, editedAtMs);
    stmt.bind(3, messageID);
    stmt.bind(4, authorID);
    return stmt.exec() > 0;
}

bool Database::deleteMessage(int64_t messageID, int64_t authorID)
{
    SQLite::Statement stmt(m_db, "DELETE FROM messages WHERE id = ? AND author_id = ?");
    stmt.bind(1, messageID);
    stmt.bind(2, authorID);
    return stmt.exec() > 0;
}

// --- reactions ---

bool Database::addReaction(int64_t messageID, int64_t userID, const std::string& emoji)
{
    SQLite::Statement stmt(m_db,
        "INSERT OR IGNORE INTO reactions(message_id, user_id, emoji) VALUES (?, ?, ?)");
    stmt.bind(1, messageID);
    stmt.bind(2, userID);
    stmt.bind(3, emoji);
    return stmt.exec() > 0;
}

bool Database::removeReaction(int64_t messageID, int64_t userID, const std::string& emoji)
{
    SQLite::Statement stmt(m_db,
        "DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?");
    stmt.bind(1, messageID);
    stmt.bind(2, userID);
    stmt.bind(3, emoji);
    return stmt.exec() > 0;
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
        "SELECT m.id, m.channel_id, m.author_id, m.content, u.username, "
        "       m.created_at, COALESCE(m.edited_at, 0) "
        "FROM messages m JOIN users u ON u.id = m.author_id "
        "WHERE m.channel_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT ?");
    stmt.bind(1, channelID);
    stmt.bind(2, beforeID);
    stmt.bind(3, limit);

    std::vector<Message> out;
    while (stmt.executeStep())
    {
        Message m;
        m.id         = stmt.getColumn(0).getInt64();
        m.channelID  = stmt.getColumn(1).getInt64();
        m.authorID   = stmt.getColumn(2).getInt64();
        m.content    = stmt.getColumn(3).getString();
        m.authorName = stmt.getColumn(4).getString();
        m.createdAt  = stmt.getColumn(5).getInt64();
        m.editedAt   = stmt.getColumn(6).getInt64();
        out.push_back(std::move(m));
    }
    return out;
}

std::vector<User> Database::guildMembers(int64_t guildID)
{
    SQLite::Statement stmt(m_db,
        "SELECT u.id, u.username FROM users u "
        "JOIN memberships m ON m.user_id = u.id "
        "WHERE m.guild_id = ? ORDER BY u.username");
    stmt.bind(1, guildID);

    std::vector<User> out;
    while (stmt.executeStep())
        out.push_back(User{stmt.getColumn(0).getInt64(), stmt.getColumn(1).getString()});
    return out;
}

std::vector<Database::ReactionRow> Database::reactionsForChannel(int64_t channelID, int64_t meUserID)
{
    SQLite::Statement stmt(m_db,
        "SELECT r.message_id, r.emoji, COUNT(*), MAX(CASE WHEN r.user_id = ? THEN 1 ELSE 0 END) "
        "FROM reactions r JOIN messages m ON m.id = r.message_id "
        "WHERE m.channel_id = ? "
        "GROUP BY r.message_id, r.emoji");
    stmt.bind(1, meUserID);
    stmt.bind(2, channelID);

    std::vector<ReactionRow> out;
    while (stmt.executeStep())
    {
        ReactionRow r;
        r.messageID = stmt.getColumn(0).getInt64();
        r.emoji     = stmt.getColumn(1).getString();
        r.count     = stmt.getColumn(2).getInt();
        r.me        = stmt.getColumn(3).getInt() != 0;
        out.push_back(std::move(r));
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
