#pragma once

#include <cstdint>
#include <string>

// Plain data structs returned by the Database layer.

struct Message
{
    int64_t     id;
    int64_t     channelID;
    int64_t     authorID;
    std::string content;
};
