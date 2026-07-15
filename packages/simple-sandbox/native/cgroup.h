#pragma once

#include <cstdint>
#include <filesystem>

#include <sys/types.h>

struct CgroupStats
{
    uint64_t cpuTimeNanoseconds;
    uint64_t memoryPeakBytes;
    uint64_t oomKillCount;
};

class Cgroup
{
public:
    Cgroup(int64_t memoryLimit, int64_t processLimit);
    ~Cgroup();

    Cgroup(const Cgroup &) = delete;
    Cgroup &operator=(const Cgroup &) = delete;
    Cgroup(Cgroup &&) = delete;
    Cgroup &operator=(Cgroup &&) = delete;

    void Attach(pid_t pid) const;
    CgroupStats ReadStats() const;
    void Kill() const;
    CgroupStats Finalize();
    void Remove();

private:
    void RemoveEmpty();

    std::filesystem::path directory;
    bool removed = false;
};

void InitializeCgroup();
