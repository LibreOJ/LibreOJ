#include <map>
#include <vector>
#include <string>
#include <functional>
#include <exception>
#include <cstring>
#include <filesystem>
#include <stdexcept>

#include <napi.h>
#include <fmt/format.h>

#include "sandbox.h"
#include "cgroup.h"

using std::string;
namespace fs = std::filesystem;

std::string GetStringWithEmptyCheck(Napi::Value value) {
    return value.IsString() ? value.ToString().Utf8Value() : "";
}

std::vector<string> StringArrayToVector(const Napi::Array &array) {
    std::vector<string> result(array.Length());
    for (size_t i = 0; i < array.Length(); i++) result[i] = GetStringWithEmptyCheck(array[i]);
    return result;
}

std::vector<int> IntArrayToVector(const Napi::Array &array) {
    std::vector<int> result(array.Length());
    for (size_t i = 0; i < array.Length(); i++) result[i] = array[i].ToNumber().Int32Value();
    return result;
}

SandboxExecutionHandle GetExecution(const Napi::Value &value)
{
    if (!value.IsExternal())
        throw std::invalid_argument("Invalid sandbox execution handle");
    const auto holder = value.As<Napi::External<SandboxExecutionHandle>>().Data();
    if (holder == nullptr || !*holder)
        throw std::invalid_argument("Expired sandbox execution handle");
    return *holder;
}

int64_t GetEffectiveMemoryLimit(int64_t requested)
{
    return requested < 0 ? -1 : requested / 4 * 5;
}

Napi::Value NodeStartSandbox(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    SandboxParameter param;
    Napi::Object jsparam = info[0].As<Napi::Object>();

    // param.timeLimit = jsparam.Get("time").ToNumber().Int32Value();
    param.memoryLimit = GetEffectiveMemoryLimit(jsparam.Get("memory").ToNumber().Int64Value());
    param.processLimit = jsparam.Get("process").ToNumber().Int32Value();
    param.redirectBeforeChroot = jsparam.Get("redirectBeforeChroot").ToBoolean().Value();
    param.mountProc = jsparam.Get("mountProc").ToBoolean().Value();
    param.chrootDirectory = fs::path(GetStringWithEmptyCheck(jsparam.Get("chroot")));
    param.workingDirectory = fs::path(GetStringWithEmptyCheck(jsparam.Get("workingDirectory")));
    param.executable = GetStringWithEmptyCheck(jsparam.Get("executable"));
    param.hostname = GetStringWithEmptyCheck(jsparam.Get("hostname"));

    const auto &cpuAffinity = jsparam.Get("cpuAffinity");
    if (cpuAffinity.IsArray()) {
        param.cpuAffinity = IntArrayToVector(cpuAffinity.As<Napi::Array>());
    }

#define SET_REDIRECTION(_name_)                                                                  \
    if (jsparam.Get(#_name_).IsNumber())                                                         \
    {                                                                                            \
        param._name_##RedirectionFileDescriptor = jsparam.Get(#_name_).ToNumber().Int32Value();  \
    }                                                                                            \
    else                                                                                         \
    {                                                                                            \
        param._name_##RedirectionFileDescriptor = -1;                                            \
        param._name_##Redirection = GetStringWithEmptyCheck(jsparam.Get(#_name_));               \
    }

    SET_REDIRECTION(stdin);
    SET_REDIRECTION(stdout);
    SET_REDIRECTION(stderr);

    auto user = jsparam.Get("user").ToObject();
    param.uid = user.Get("uid").ToNumber().Uint32Value();
    param.gid = user.Get("gid").ToNumber().Uint32Value();

    param.stackSize = jsparam.Get("stackSize").ToNumber().Int64Value();
    if (param.stackSize <= 0) {
        param.stackSize = -2;
    }

    param.executableParameters = StringArrayToVector(jsparam.Get("parameters").As<Napi::Array>());
    param.environmentVariables = StringArrayToVector(jsparam.Get("environments").As<Napi::Array>());
    Napi::Array mounts = jsparam.Get("mounts").As<Napi::Array>();
    for (size_t i = 0; i < mounts.Length(); i++)
    {
        Napi::Object mntObj = static_cast<Napi::Value>(mounts[i]).As<Napi::Object>();
        MountInfo mnt;
        mnt.src = fs::path(GetStringWithEmptyCheck(mntObj.Get("src")));
        mnt.dst = fs::path(GetStringWithEmptyCheck(mntObj.Get("dst")));
        mnt.limit = mntObj.Get("limit").ToNumber().Int32Value();
        param.mounts.push_back(mnt);
    }

    try
    {
        auto holder = new SandboxExecutionHandle(StartSandbox(param));
        Napi::Object result = Napi::Object::New(env);
        result.Set("pid", Napi::Number::New(env, GetSandboxPid(*holder)));
        result.Set(
            "execution",
            Napi::External<SandboxExecutionHandle>::New(
                env, holder, [](Napi::Env, SandboxExecutionHandle *value) { delete value; }));
        return result;
    }
    catch (std::exception &ex)
    {
        Napi::Error::New(env, ex.what()).ThrowAsJavaScriptException();
    }
    catch (...)
    {
        Napi::Error::New(env, "Something unexpected happened while starting sandbox.").ThrowAsJavaScriptException();
    }
    return Napi::Value();
}

class WaitForProcessWorker : public Napi::AsyncWorker
{
private:
    SandboxExecutionHandle execution;
    ExecutionResult result;

public:
    WaitForProcessWorker(Napi::Function &callback, SandboxExecutionHandle execution)
        : Napi::AsyncWorker(callback), execution(execution) {}

    void Execute()
    {
        try
        {
            result = WaitForProcess(execution);
        }
        catch (std::exception &ex)
        {
            SetError(ex.what());
        }
        catch (...)
        {
            SetError("Something unexpected occurred while waiting for process termiation");
        }
    }

    void OnOK()
    {
        Napi::Env env = Env();

        Napi::Object obj = Napi::Object::New(env);

        obj.Set("status", result.status == EXITED ? "exited" : "signaled");
        obj.Set("code", result.code);

        Callback().Call({env.Undefined(), obj});
    }
};


void NodeWaitForProcess(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    SandboxExecutionHandle execution = GetExecution(info[0]);
    Napi::Function callback = info[1].As<Napi::Function>();

    WaitForProcessWorker *waitForProcessWorker = new WaitForProcessWorker(callback, execution);
    waitForProcessWorker->Queue();
}

Napi::Object EncodeStats(Napi::Env env, const CgroupStats &stats)
{
    auto result = Napi::Object::New(env);
    result.Set("cpuTimeNanoseconds", std::to_string(stats.cpuTimeNanoseconds));
    result.Set("memoryPeakBytes", std::to_string(stats.memoryPeakBytes));
    result.Set("oomKillCount", std::to_string(stats.oomKillCount));
    return result;
}

Napi::Value NodeReadSandboxStats(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    try
    {
        return EncodeStats(env, ReadSandboxStats(GetExecution(info[0])));
    }
    catch (std::exception &ex)
    {
        Napi::Error::New(env, ex.what()).ThrowAsJavaScriptException();
    }
    return Napi::Value();
}

Napi::Value NodeFinalizeSandboxCgroup(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    try
    {
        return EncodeStats(env, FinalizeSandboxCgroup(GetExecution(info[0])));
    }
    catch (std::exception &ex)
    {
        Napi::Error::New(env, ex.what()).ThrowAsJavaScriptException();
    }
    return Napi::Value();
}

void NodeKillSandbox(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    try
    {
        KillSandbox(GetExecution(info[0]));
    }
    catch (std::exception &ex)
    {
        Napi::Error::New(env, ex.what()).ThrowAsJavaScriptException();
    }
}

void NodeRemoveSandboxCgroup(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    try
    {
        RemoveSandboxCgroup(GetExecution(info[0]));
    }
    catch (std::exception &ex)
    {
        Napi::Error::New(env, ex.what()).ThrowAsJavaScriptException();
    }
}

Napi::Value NodeGetUidAndGidInSandbox(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    fs::path rootfs = info[0].As<Napi::String>().Utf8Value();
    auto username = info[1].As<Napi::String>().Utf8Value();

    std::vector<char> dataBuffer;
    passwd user;
    try {
        GetUserEntryInSandbox(rootfs, username, dataBuffer, user);
    } catch (std::exception &ex) {
        Napi::Error::New(env, ex.what()).ThrowAsJavaScriptException();
        return env.Undefined();
    }

    auto result = Napi::Object::New(env);
    result.Set("uid", Napi::Number::New(env, user.pw_uid));
    result.Set("gid", Napi::Number::New(env, user.pw_gid));

    return result;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    try
    {
        InitializeCgroup();
        exports.Set("readSandboxStats", Napi::Function::New(env, NodeReadSandboxStats));
        exports.Set("finalizeSandboxCgroup", Napi::Function::New(env, NodeFinalizeSandboxCgroup));
        exports.Set("killSandbox", Napi::Function::New(env, NodeKillSandbox));
        exports.Set("removeSandboxCgroup", Napi::Function::New(env, NodeRemoveSandboxCgroup));
        exports.Set("getUidAndGidInSandbox", Napi::Function::New(env, NodeGetUidAndGidInSandbox));
        exports.Set("startSandbox", Napi::Function::New(env, NodeStartSandbox));
        exports.Set("waitForProcess", Napi::Function::New(env, NodeWaitForProcess));
    }
    catch (std::exception &ex)
    {
        Napi::Error::New(env, ex.what()).ThrowAsJavaScriptException();
    }
    return exports;
}

NODE_API_MODULE(NODE_MODULE_NAME, Init)
