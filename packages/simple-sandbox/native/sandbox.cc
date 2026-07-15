#include <string>
#include <iostream>
#include <exception>
#include <functional>
#include <system_error>
#include <vector>
#include <stdexcept>
#include <memory>
#include <mutex>

#include <cstring>
#include <cassert>

#include <filesystem>

#include <fcntl.h>
#include <sched.h>
#include <signal.h>
#include <unistd.h>
#include <sys/types.h>
#include <syscall.h>
#include <grp.h>
#include <sys/time.h>
#include <sys/resource.h>
#include <sys/mount.h>
#include <sys/wait.h>
#include <sys/resource.h>

#include <fmt/format.h>
#include <fmt/ostream.h>
#if FMT_VERSION >= 90000
#include <fmt/std.h>
#endif

#include "sandbox.h"
#include "utils.h"
#include "cgroup.h"
#include "semaphore.h"
#include "pipe.h"

namespace fs = std::filesystem;
using std::string;
using std::vector;
using fmt::format;

// Make sure fd 0,1,2 exists.
static void RedirectIO(const SandboxParameter &param, int nullfd)
{
    const string &std_input = param.stdinRedirection,
                 std_output = param.stdoutRedirection,
                 std_error = param.stderrRedirection;

    int inputfd, outputfd, errorfd;
    if (param.stdinRedirectionFileDescriptor == -1)
    {
        if (std_input != "")
        {
            inputfd = ENSURE(open(std_input.c_str(), O_RDONLY));
        }
        else
        {
            inputfd = nullfd;
        }
    }
    else
    {
        inputfd = param.stdinRedirectionFileDescriptor;
    }
    ENSURE(dup2(inputfd, STDIN_FILENO));

    if (param.stdoutRedirectionFileDescriptor == -1)
    {
        if (std_output != "")
        {
            outputfd = ENSURE(open(std_output.c_str(), O_WRONLY | O_TRUNC | O_CREAT,
                                   S_IWUSR | S_IRUSR | S_IRGRP | S_IWGRP));
        }
        else
        {
            outputfd = nullfd;
        }
    }
    else
    {
        outputfd = param.stdoutRedirectionFileDescriptor;
    }
    ENSURE(dup2(outputfd, STDOUT_FILENO));

    if (param.stderrRedirectionFileDescriptor == -1)
    {
        if (std_error != "")
        {
            if (std_error == std_output)
            {
                errorfd = outputfd;
            }
            else
            {
                errorfd = ENSURE(open(std_error.c_str(), O_WRONLY | O_TRUNC | O_CREAT,
                                      S_IWUSR | S_IRUSR | S_IRGRP | S_IWGRP));
            }
        }
        else
        {
            errorfd = nullfd;
        }
    }
    else
    {
        errorfd = param.stderrRedirectionFileDescriptor;
    }
    ENSURE(dup2(errorfd, STDERR_FILENO));
}

class SandboxExecution
{
public:
    SandboxParameter parameter;

    PosixSemaphore semaphore1, semaphore2;
    // This pipe is used to forward error message from the child process to the parent.
    PosixPipe pipefd;
    Cgroup cgroup;
    pid_t pid = -1;
    bool reaped = false;

    SandboxExecution(const SandboxParameter &param, int pipeOptions)
        : parameter(param), semaphore1(true, 0), semaphore2(true, 0), pipefd(pipeOptions),
          cgroup(param.memoryLimit, param.processLimit)
    {
    }
};

static void EnsureDirectoryExistance(fs::path dir) {
    if (!fs::exists(dir))
    {
        throw std::runtime_error((format("The specified path {} does not exist.", dir)));
    }
    if (!fs::is_directory(dir))
    {
        throw std::runtime_error((format("The specified path {} exists, but is not a directory.", dir)));
    }
}

void GetUserEntryInSandbox(const fs::path &rootfs, const std::string username, std::vector<char> &dataBuffer, passwd &entry) {
    auto passwdFilePath = rootfs / "etc" / "passwd";
    std::unique_ptr<FILE, FileCloser> passwdFile(fopen(passwdFilePath.c_str(), "r"));
    if (passwdFile == nullptr)
        throw std::system_error(errno, std::system_category(), "Couldn't open /etc/passwd in rootfs");

    long passwdBufferSize = sysconf(_SC_GETPW_R_SIZE_MAX);
    if (passwdBufferSize == -1) passwdBufferSize = 16384;
    dataBuffer.resize(passwdBufferSize);

    passwd *user = nullptr;
    while (fgetpwent_r(passwdFile.get(), &entry, dataBuffer.data(), passwdBufferSize, &user) == 0)
        if (username == user->pw_name)
            break;

    if (user == nullptr)
        if (errno == ENOENT)
            throw std::invalid_argument(format("No such user: {}", username));
        else
            throw std::system_error(errno, std::system_category(), "fgetpwent_r");
}

static int ChildProcess(void *param_ptr)
{
    SandboxExecution &execParam = *reinterpret_cast<SandboxExecution *>(param_ptr);
    // We obtain a full copy of parameters here. The arguments may be destoryed after some time.
    SandboxParameter parameter = execParam.parameter;

    try
    {
        ENSURE(close(execParam.pipefd[0]));

        if (!execParam.parameter.cpuAffinity.empty()) {
            cpu_set_t mask;
            CPU_ZERO(&mask);
            for (auto cpu : execParam.parameter.cpuAffinity)
                CPU_SET(cpu, &mask);
            ENSURE(sched_setaffinity(0, sizeof(cpu_set_t), &mask));
        }

        int nullfd = ENSURE(open("/dev/null", O_RDWR));
        if (parameter.redirectBeforeChroot)
        {
            RedirectIO(parameter, nullfd);
        }

        ENSURE(mount("none", "/", NULL, MS_REC | MS_PRIVATE, NULL)); // Make root private

        EnsureDirectoryExistance(parameter.chrootDirectory);
        ENSURE(mount(parameter.chrootDirectory.string().c_str(),
                     parameter.chrootDirectory.string().c_str(), "", MS_BIND | MS_RDONLY | MS_REC, ""));
        ENSURE(mount("", parameter.chrootDirectory.string().c_str(), "", MS_BIND | MS_REMOUNT | MS_RDONLY | MS_REC, ""));

        for (MountInfo &info : parameter.mounts)
        {
            if (!info.dst.is_absolute()) {
                throw std::invalid_argument(format("The dst path {} in mounts should be absolute.", info.dst));
            }

            fs::path target = parameter.chrootDirectory / std::filesystem::relative(info.dst, "/");
	    
            EnsureDirectoryExistance(info.src);
            EnsureDirectoryExistance(target);
            ENSURE(mount(info.src.string().c_str(), target.string().c_str(), "", MS_BIND | MS_REC, ""));
            if (info.limit == 0)
            {
                ENSURE(mount("", target.string().c_str(), "", MS_BIND | MS_REMOUNT | MS_RDONLY | MS_REC, ""));
            }
            else if (info.limit != -1)
            {
                // TODO: implement.
            }
        }

        ENSURE(chroot(parameter.chrootDirectory.string().c_str()));
        ENSURE(chdir(parameter.workingDirectory.string().c_str()));

        if (parameter.mountProc)
        {
            ENSURE(mount("proc", "/proc", "proc", 0, NULL));
        }
        if (!parameter.redirectBeforeChroot)
        {
            RedirectIO(parameter, nullfd);
        }

        if (!parameter.hostname.empty()) {
            ENSURE(sethostname(parameter.hostname.c_str(), parameter.hostname.length()));
        }

        if (parameter.stackSize != -2)
        {
            rlimit64 rlim;
            rlim.rlim_max = rlim.rlim_cur = parameter.stackSize != -1 ? parameter.stackSize : RLIM64_INFINITY;
            ENSURE(setrlimit64(RLIMIT_STACK, &rlim));
        }

        {
            rlimit rlim;
            rlim.rlim_max = rlim.rlim_cur = 0;
            ENSURE(setrlimit(RLIMIT_CORE, &rlim));
        }

        gid_t groupList[1];
        groupList[0] = parameter.gid;
        ENSURE(syscall(SYS_setgid, parameter.gid));
        ENSURE(syscall(SYS_setgroups, 1, groupList));
        ENSURE(syscall(SYS_setuid, parameter.uid));

        vector<char *> params = StringToPtr(parameter.executableParameters),
                       envi = StringToPtr(parameter.environmentVariables);

        int temp = -1;
        // Inform the parent that no exception occurred.
        ENSURE(write(execParam.pipefd[1], &temp, sizeof(int)));

        // Inform our parent that we are ready to go.
        execParam.semaphore1.Post();
        // Wait for parent's reply.
        execParam.semaphore2.Wait();

        ENSURE(execvpe(parameter.executable.c_str(), &params[0], &envi[0]));

        // If execvpe returns, then we meet an error.
        return 1;
    }
    catch (std::exception &err)
    {
        const char *errMessage = err.what();
        int len = strlen(errMessage);
        try
        {
            ENSURE(write(execParam.pipefd[1], &len, sizeof(int)));
            ENSURE(write(execParam.pipefd[1], errMessage, len));
            ENSURE(close(execParam.pipefd[1]));
            execParam.semaphore1.Post();
            return 1;
        }
        catch (...)
        {
            assert(false);
        }
    }
    catch (...)
    {
        assert(false);
    }

    return 1;
}

// The child stack is only used before `execvpe`, so it does not need much space.
const int childStackSize = 1024 * 700;
SandboxExecutionHandle StartSandbox(const SandboxParameter &parameter)
{
    auto execution = std::make_shared<SandboxExecution>(parameter, O_CLOEXEC | O_NONBLOCK);
    try
    {
        // char* childStack = new char[childStackSize];
        std::vector<char> childStack(childStackSize); // I don't want to call `delete`

        execution->pid = ENSURE(clone(ChildProcess, childStack.data() + childStack.size(),
                                      CLONE_NEWNET | CLONE_NEWUTS | CLONE_NEWPID | CLONE_NEWNS | SIGCHLD,
                                      const_cast<void *>(reinterpret_cast<const void *>(execution.get()))));
        // Wait for at most 500ms. If the child process hasn't posted the semaphore,
        // We will assume that the child has already dead.
        bool waitResult = execution->semaphore1.TimedWait(500);

        int errLen, bytesRead = read(execution->pipefd[0], &errLen, sizeof(int));
        // Child will be killed once the error has been thrown.
        if (!waitResult || bytesRead == 0 || bytesRead == -1)
        {
            const auto waitResult = waitpid(execution->pid, nullptr, WNOHANG);
            if (waitResult == 0)
            {
                // The child process is still alive.
                throw std::runtime_error("The child process is not responding.");
            }
            if (waitResult == execution->pid)
                execution->reaped = true;
            else if (waitResult == -1)
                throw std::system_error(errno, std::system_category(), "Cannot inspect the failed sandbox child");
            // The child process exited with no information available.
            throw std::runtime_error("The child process has exited unexpectedly.");
        }
        else if (errLen != -1) // -1 indicates OK.
        {
            vector<char> buf(errLen);
            ENSURE(read(execution->pipefd[0], &*buf.begin(), errLen));
            string errstr(buf.begin(), buf.end());
            throw std::runtime_error((format("The child process has reported the following error: {}", errstr)));
        }

        execution->cgroup.Attach(execution->pid);
        // Continue the child.
        execution->semaphore2.Post();

        return execution;
    }
    catch (...)
    {
        const auto failure = std::current_exception();
        vector<string> cleanupFailures;
        if (execution->pid != -1 && !execution->reaped)
        {
            if (kill(execution->pid, SIGKILL) == -1 && errno != ESRCH)
                cleanupFailures.push_back(std::system_error(errno, std::system_category(), "Cannot kill sandbox child").what());

            while (true)
            {
                const auto waitResult = waitpid(execution->pid, nullptr, 0);
                if (waitResult == execution->pid)
                {
                    execution->reaped = true;
                    break;
                }
                if (waitResult == -1 && errno == EINTR)
                    continue;
                if (waitResult == -1 && errno == ECHILD)
                {
                    execution->reaped = true;
                    break;
                }
                if (waitResult == -1)
                    cleanupFailures.push_back(
                        std::system_error(errno, std::system_category(), "Cannot reap sandbox child").what());
                break;
            }
        }
        try
        {
            execution->cgroup.Remove();
        }
        catch (const std::exception &cleanupError)
        {
            cleanupFailures.push_back(cleanupError.what());
        }

        if (!cleanupFailures.empty())
        {
            string cleanupMessage;
            for (const auto &cleanupFailure : cleanupFailures)
            {
                if (!cleanupMessage.empty())
                    cleanupMessage += "; ";
                cleanupMessage += cleanupFailure;
            }
            try
            {
                std::rethrow_exception(failure);
            }
            catch (...)
            {
                std::throw_with_nested(std::runtime_error(format("Sandbox startup cleanup failed: {}", cleanupMessage)));
            }
        }
        std::rethrow_exception(failure);
    }
}

ExecutionResult
WaitForProcess(const SandboxExecutionHandle &execution)
{
    ExecutionResult result;
    int status;
    ENSURE(waitpid(execution->pid, &status, 0));
    execution->reaped = true;

    // Try reading error message first
    int errLen, bytesRead = read(execution->pipefd[0], &errLen, sizeof(int));
    if (bytesRead > 0)
    {
        vector<char> buf(errLen);
        ENSURE(read(execution->pipefd[0], &*buf.begin(), errLen));
        string errstr(buf.begin(), buf.end());
        throw std::runtime_error((format("The child process has reported the following error: {}", errstr)));
    }

    if (WIFEXITED(status))
    {
        result.status = EXITED;
        result.code = WEXITSTATUS(status);
    }
    else if (WIFSIGNALED(status))
    {
        result.status = SIGNALED;
        result.code = WTERMSIG(status);
    }
    return result;
}

pid_t GetSandboxPid(const SandboxExecutionHandle &execution)
{
    return execution->pid;
}

CgroupStats ReadSandboxStats(const SandboxExecutionHandle &execution)
{
    return execution->cgroup.ReadStats();
}

CgroupStats FinalizeSandboxCgroup(const SandboxExecutionHandle &execution)
{
    return execution->cgroup.Finalize();
}

void KillSandbox(const SandboxExecutionHandle &execution)
{
    execution->cgroup.Kill();
}

void RemoveSandboxCgroup(const SandboxExecutionHandle &execution)
{
    execution->cgroup.Remove();
}
