#pragma once

// Moot v1 schema DDL. Safe to run on every startup (IF NOT EXISTS).
// ids are SQLite-assigned rowids (INTEGER PRIMARY KEY), monotonic so
// cursor pagination works. No created_at columns yet.
inline constexpr const char* SCHEMA_SQL = R"sql(
    CREATE TABLE IF NOT EXISTS users (
        id       INTEGER PRIMARY KEY,
        username TEXT    NOT NULL,
        token    TEXT    NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS guilds (
        id       INTEGER PRIMARY KEY,
        name     TEXT    NOT NULL,
        owner_id INTEGER NOT NULL REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS channels (
        id       INTEGER PRIMARY KEY,
        guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
        name     TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memberships (
        guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
        user_id  INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
        PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
        id         INTEGER PRIMARY KEY,
        channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        author_id  INTEGER NOT NULL REFERENCES users(id),
        content    TEXT    NOT NULL,
        created_at INTEGER NOT NULL DEFAULT 0,  -- unix ms
        edited_at  INTEGER                       -- unix ms, NULL if never edited
    );

    CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, id);

    -- one row per (message, user, emoji)
    CREATE TABLE IF NOT EXISTS reactions (
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
        emoji      TEXT    NOT NULL,
        PRIMARY KEY (message_id, user_id, emoji)
    );
)sql";
