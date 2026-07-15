#include <array>
#include <cerrno>
#include <chrono>
#include <cstdint>
#include <cstring>
#include <fcntl.h>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <limits>
#include <map>
#include <set>
#include <sstream>
#include <stdexcept>
#include <string>
#include <system_error>
#include <utility>
#include <vector>

#include <linux/magic.h>
#include <poll.h>
#include <sys/random.h>
#include <sys/stat.h>
#include <sys/vfs.h>
#include <unistd.h>

#include <fmt/format.h>

#include "cgroup.h"

namespace fs = std::filesystem;
using fmt::format;

namespace
{
constexpr auto cgroupMount = "/sys/fs/cgroup";
constexpr auto supervisorGroup = "supervisor";
constexpr std::array<const char *, 3> requiredControllers = {"cpu", "memory", "pids"};

[[noreturn]] void ThrowSystemError(const std::string &operation, const fs::path &path)
{
    const auto error = errno;
    throw std::system_error(error, std::system_category(), format("{} {}", operation, path.string()));
}

std::string ReadFile(const fs::path &path)
{
    std::ifstream stream;
    stream.exceptions(std::ios::failbit | std::ios::badbit);
    stream.open(path);
    std::ostringstream content;
    content << stream.rdbuf();
    return content.str();
}

void WriteFile(const fs::path &path, const std::string &value)
{
    const auto descriptor = open(path.c_str(), O_WRONLY | O_CLOEXEC);
    if (descriptor == -1)
        ThrowSystemError("Cannot open", path);

    size_t written = 0;
    while (written < value.size())
    {
        const auto result = write(descriptor, value.data() + written, value.size() - written);
        if (result == -1)
        {
            if (errno == EINTR)
                continue;
            const auto error = errno;
            close(descriptor);
            errno = error;
            ThrowSystemError("Cannot write", path);
        }
        if (result == 0)
        {
            close(descriptor);
            throw std::runtime_error(format("Write to {} made no progress", path.string()));
        }
        written += static_cast<size_t>(result);
    }

    if (close(descriptor) == -1)
        ThrowSystemError("Cannot close", path);
}

std::set<std::string> ReadWords(const fs::path &path)
{
    std::istringstream stream(ReadFile(path));
    std::set<std::string> values;
    std::string value;
    while (stream >> value)
        values.insert(value);
    if (!stream.eof())
        throw std::runtime_error(format("Cannot parse {}", path.string()));
    return values;
}

std::map<std::string, uint64_t> ReadKeyValues(const fs::path &path)
{
    std::istringstream stream(ReadFile(path));
    std::map<std::string, uint64_t> values;
    std::string line;
    while (std::getline(stream, line))
    {
        if (line.empty())
            continue;
        std::istringstream entry(line);
        std::string key;
        uint64_t value;
        if (!(entry >> key >> value))
            throw std::runtime_error(format("Cannot parse {}", path.string()));
        entry >> std::ws;
        if (!entry.eof())
            throw std::runtime_error(format("Unexpected data in {}", path.string()));
        if (!values.emplace(key, value).second)
            throw std::runtime_error(format("Duplicate key {} in {}", key, path.string()));
    }
    if (!stream.eof())
        throw std::runtime_error(format("Cannot parse {}", path.string()));
    return values;
}

void RequireDomainCgroup(const fs::path &directory)
{
    const auto type = ReadWords(directory / "cgroup.type");
    if (type != std::set<std::string>{"domain"})
        throw std::runtime_error(format("{} is not a domain cgroup", directory.string()));
}

uint64_t RequireValue(const std::map<std::string, uint64_t> &values, const std::string &key, const fs::path &path)
{
    const auto iterator = values.find(key);
    if (iterator == values.end())
        throw std::runtime_error(format("Missing key {} in {}", key, path.string()));
    return iterator->second;
}

uint64_t ReadInteger(const fs::path &path)
{
    std::istringstream stream(ReadFile(path));
    uint64_t value;
    if (!(stream >> value))
        throw std::runtime_error(format("Cannot parse {}", path.string()));
    stream >> std::ws;
    if (!stream.eof())
        throw std::runtime_error(format("Unexpected data in {}", path.string()));
    return value;
}

fs::path ReadOwnCgroup()
{
    std::ifstream stream;
    stream.exceptions(std::ios::failbit | std::ios::badbit);
    stream.open("/proc/self/cgroup");

    std::string line;
    while (std::getline(stream, line))
    {
        if (line.rfind("0::", 0) == 0)
        {
            fs::path path(line.substr(3));
            if (!path.is_absolute() || path.lexically_normal() != path)
                throw std::runtime_error(format("Invalid unified cgroup path {}", path.string()));
            return path;
        }
    }
    throw std::runtime_error("The process is not in a unified cgroup v2 hierarchy");
}

fs::path DiscoverDelegatedRoot()
{
    struct statfs filesystemInfo;
    if (statfs(cgroupMount, &filesystemInfo) == -1)
        ThrowSystemError("Cannot inspect", cgroupMount);
    if (filesystemInfo.f_type != CGROUP2_SUPER_MAGIC)
        throw std::runtime_error("/sys/fs/cgroup is not a cgroup v2 filesystem");

    const auto ownCgroup = ReadOwnCgroup();
    if (ownCgroup.filename() != supervisorGroup)
        throw std::runtime_error("simple-sandbox must run in a systemd unit with DelegateSubgroup=supervisor");

    const auto delegatedRoot = fs::path(cgroupMount) / ownCgroup.parent_path().relative_path();
    RequireDomainCgroup(delegatedRoot);
    if (!ReadWords(delegatedRoot / "cgroup.procs").empty())
        throw std::runtime_error(format("The delegated cgroup {} contains manager processes", delegatedRoot.string()));

    const auto available = ReadWords(delegatedRoot / "cgroup.controllers");
    for (const auto *controller : requiredControllers)
        if (!available.count(controller))
            throw std::runtime_error(format("Controller {} is unavailable in {}", controller, delegatedRoot.string()));

    const auto enabled = ReadWords(delegatedRoot / "cgroup.subtree_control");
    std::string enable;
    for (const auto *controller : requiredControllers)
        if (!enabled.count(controller))
            enable += format("+{} ", controller);
    if (!enable.empty())
        WriteFile(delegatedRoot / "cgroup.subtree_control", enable);

    const auto verified = ReadWords(delegatedRoot / "cgroup.subtree_control");
    for (const auto *controller : requiredControllers)
        if (!verified.count(controller))
            throw std::runtime_error(format("Controller {} could not be enabled in {}", controller, delegatedRoot.string()));

    return delegatedRoot;
}

const fs::path &GetDelegatedRoot()
{
    static const auto root = DiscoverDelegatedRoot();
    return root;
}

std::string GenerateCgroupName()
{
    std::array<unsigned char, 16> bytes;
    size_t offset = 0;
    while (offset < bytes.size())
    {
        const auto result = getrandom(bytes.data() + offset, bytes.size() - offset, 0);
        if (result == -1)
        {
            if (errno == EINTR)
                continue;
            ThrowSystemError("Cannot generate a cgroup name under", GetDelegatedRoot());
        }
        offset += static_cast<size_t>(result);
    }

    std::ostringstream name;
    name << "sandbox-" << std::hex << std::setfill('0');
    for (const auto byte : bytes)
        name << std::setw(2) << static_cast<unsigned int>(byte);
    return name.str();
}

fs::path CreateDirectory()
{
    for (int attempt = 0; attempt < 4; ++attempt)
    {
        const auto directory = GetDelegatedRoot() / GenerateCgroupName();
        if (mkdir(directory.c_str(), 0755) == 0)
            return directory;
        if (errno != EEXIST)
            ThrowSystemError("Cannot create", directory);
    }
    throw std::runtime_error("Could not allocate a unique cgroup name");
}

void RequireFiles(const fs::path &directory)
{
    constexpr std::array<const char *, 11> files = {
        "cgroup.events", "cgroup.kill", "cgroup.procs", "cpu.stat", "memory.events.local", "memory.max",
        "memory.oom.group", "memory.peak", "memory.swap.max", "pids.max", "cgroup.type"};
    for (const auto *file : files)
        if (!fs::is_regular_file(directory / file))
            throw std::runtime_error(format("Required cgroup v2 interface {} is unavailable", (directory / file).string()));
    RequireDomainCgroup(directory);
}

void WriteLimit(const fs::path &path, int64_t limit)
{
    WriteFile(path, limit < 0 ? "max" : std::to_string(limit));
}

bool IsPopulated(const fs::path &directory)
{
    const auto path = directory / "cgroup.events";
    return RequireValue(ReadKeyValues(path), "populated", path) != 0;
}

void WaitUntilEmpty(const fs::path &directory)
{
    const auto eventsPath = directory / "cgroup.events";
    const auto descriptor = open(eventsPath.c_str(), O_RDONLY | O_CLOEXEC);
    if (descriptor == -1)
        ThrowSystemError("Cannot open", eventsPath);

    const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(5);
    while (IsPopulated(directory))
    {
        const auto remaining = std::chrono::duration_cast<std::chrono::milliseconds>(deadline - std::chrono::steady_clock::now());
        if (remaining.count() <= 0)
        {
            close(descriptor);
            throw std::runtime_error(format("Timed out waiting for {} to become empty", directory.string()));
        }

        pollfd event = {descriptor, POLLPRI, 0};
        const auto result = poll(&event, 1, static_cast<int>(remaining.count()));
        if (result == -1)
        {
            if (errno == EINTR)
                continue;
            const auto error = errno;
            close(descriptor);
            errno = error;
            ThrowSystemError("Cannot poll", eventsPath);
        }
    }

    if (close(descriptor) == -1)
        ThrowSystemError("Cannot close", eventsPath);
}
}

void InitializeCgroup()
{
    (void)GetDelegatedRoot();
}

Cgroup::Cgroup(int64_t memoryLimit, int64_t processLimit) : directory(CreateDirectory())
{
    try
    {
        RequireFiles(directory);
        WriteLimit(directory / "memory.max", memoryLimit);
        WriteFile(directory / "memory.swap.max", "0");
        WriteFile(directory / "memory.oom.group", "1");
        WriteLimit(directory / "pids.max", processLimit);
    }
    catch (...)
    {
        const auto failure = std::current_exception();
        if (rmdir(directory.c_str()) == -1)
        {
            const auto cleanupError = errno;
            try
            {
                std::rethrow_exception(failure);
            }
            catch (...)
            {
                std::throw_with_nested(std::system_error(
                    cleanupError, std::system_category(), format("Cannot remove incomplete cgroup {}", directory.string())));
            }
        }
        removed = true;
        std::rethrow_exception(failure);
    }
}

Cgroup::~Cgroup()
{
    if (!removed)
    {
        try
        {
            Remove();
        }
        catch (const std::exception &error)
        {
            dprintf(STDERR_FILENO, "Failed to clean up cgroup %s: %s\n", directory.c_str(), error.what());
        }
    }
}

void Cgroup::Attach(pid_t pid) const
{
    WriteFile(directory / "cgroup.procs", std::to_string(pid));
}

CgroupStats Cgroup::ReadStats() const
{
    const auto cpuPath = directory / "cpu.stat";
    const auto memoryEventsPath = directory / "memory.events.local";
    const auto cpuMicroseconds = RequireValue(ReadKeyValues(cpuPath), "usage_usec", cpuPath);
    if (cpuMicroseconds > std::numeric_limits<uint64_t>::max() / 1000)
        throw std::overflow_error("CPU usage cannot be represented in nanoseconds");

    const auto memoryEvents = ReadKeyValues(memoryEventsPath);
    const auto oomKill = RequireValue(memoryEvents, "oom_kill", memoryEventsPath);
    const auto oomGroupKill = memoryEvents.count("oom_group_kill") ? memoryEvents.at("oom_group_kill") : 0;

    return {
        cpuMicroseconds * 1000,
        ReadInteger(directory / "memory.peak"),
        oomKill + oomGroupKill};
}

void Cgroup::Kill() const
{
    WriteFile(directory / "cgroup.kill", "1");
}

CgroupStats Cgroup::Finalize()
{
    if (removed)
        throw std::runtime_error(format("Cgroup {} has already been removed", directory.string()));
    Kill();
    WaitUntilEmpty(directory);
    const auto stats = ReadStats();
    RemoveEmpty();
    return stats;
}

void Cgroup::RemoveEmpty()
{
    if (rmdir(directory.c_str()) == -1)
        ThrowSystemError("Cannot remove", directory);
    removed = true;
}

void Cgroup::Remove()
{
    if (removed)
        return;
    Kill();
    WaitUntilEmpty(directory);
    RemoveEmpty();
}
