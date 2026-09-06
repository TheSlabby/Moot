cmake_minimum_required(VERSION 3.16)

project(Moot LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# sqlite wrapper
include(FetchContent)
FetchContent_Declare(
    SQLiteCpp
    GIT_REPOSITORY https://github.com/SRombauts/SQLiteCpp.git
    GIT_TAG        3.3.3
)
FetchContent_MakeAvailable(SQLiteCpp)

find_package(Boost 1.81 REQUIRED COMPONENTS json)
find_package(Threads REQUIRED)

add_executable(moot
    main.cpp
    Database.cpp
)

target_link_libraries(moot PRIVATE
    Boost::headers
    Boost::json
    Threads::Threads
    SQLiteCpp
)