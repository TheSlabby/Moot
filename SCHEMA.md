# Moot v1 Schema

Five tables. Snowflake ids (app-generated 64-bit ints, stored as SQLite `INTEGER`).
No `created_at` columns — the Snowflake id already encodes creation time.

```
users ──owns──▶ guilds ──has──▶ channels ──has──▶ messages
  ▲               │
  └──memberships──┘   (which users are in which guilds)
```

## Tables

| Table | Columns | Meaning |
|-------|---------|---------|
| **users** | `id`, `username`, `token` | An account. `token` is placeholder auth. |
| **guilds** | `id`, `name`, `owner_id` | A "server". Owns channels, has members. |
| **channels** | `id`, `guild_id`, `name` | Belongs to one guild. |
| **memberships** | `guild_id`, `user_id` | Join table: user ↔ guild (many-to-many). |
| **messages** | `id`, `channel_id`, `author_id`, `content` | A message in a channel. |

- One-to-many (guild→channels, channel→messages): child row holds the parent id.
- Many-to-many (guild↔users): the `memberships` join table.
- `ON DELETE CASCADE` on ownership edges (needs `PRAGMA foreign_keys = ON`).
- Index `idx_messages_channel (channel_id, id)` powers history pagination.

## The auth query (IDENTIFY)

Client sends a token; server resolves it to a user, then stores that `user_id`
on the in-memory Session for the life of the connection.

```sql
SELECT id, username FROM users WHERE token = ?;
```

## History pagination query

The reason for Snowflakes — the id *is* the cursor.

```sql
SELECT id, author_id, content
FROM messages
WHERE channel_id = ? AND id < ?
ORDER BY id DESC
LIMIT 50;
```

## Dev seed data

Two users are seeded for testing:

| id | username | token |
|----|----------|-------|
| 1 | walker | `dev-token-walker` |
| 2 | alice | `dev-token-alice` |

## Files

- `Schema.hpp` — the canonical DDL (`SCHEMA_SQL`), run by `Database` on startup.
- `moot.sqlite` — the database (created/populated at runtime; do not commit).

## Deliberately not in v1

Roles/permissions, DMs, channel types/ordering, message edits/deletes,
attachments, avatars, real auth (registration/login, hashed tokens, expiry).
