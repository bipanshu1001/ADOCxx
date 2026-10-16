cmake_minimum_required(VERSION 3.10)
project(adoc_rocksdb CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

add_executable(adoc_rocksdb
    main.cpp
    rocksdb_metrics.cpp
    rocksdb_stall_listener.cpp
    ../adoc_tuner.cpp)          # the SAME verified tuner, unchanged

# The tuner header lives one directory up.
target_include_directories(adoc_rocksdb PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/..)

# Prefer a RocksDB CMake package (vcpkg / newer distros); otherwise link by name
# (Debian/Ubuntu librocksdb-dev) plus the compression libraries it depends on.
find_package(RocksDB CONFIG QUIET)
if(RocksDB_FOUND)
    target_link_libraries(adoc_rocksdb PRIVATE RocksDB::rocksdb)
else()
    target_link_libraries(adoc_rocksdb PRIVATE
        rocksdb pthread dl z bz2 snappy lz4 zstd)
endif()
