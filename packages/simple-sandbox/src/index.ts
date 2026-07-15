import { SandboxParameter } from './interfaces';
import nativeAddon from './nativeAddon';
import { SandboxProcess } from './sandboxProcess';

export * from './interfaces';

const MAX_RETRY_TIMES = 20;
export function startSandbox(parameter: SandboxParameter): SandboxProcess {
    const doStart = () => {
        const actualParameter = Object.assign({}, parameter);
        const startResult = nativeAddon.startSandbox(actualParameter);
        return new SandboxProcess(actualParameter, startResult.pid, startResult.execution);
    };

    let retryTimes = MAX_RETRY_TIMES;
    while (1) {
        try {
            return doStart();
        } catch (e) {
            // Retry if the child process fails
            if ("message" in e && typeof e.message === "string" && e.message.startsWith("The child process ")) {
                if (retryTimes-- > 0)
                    continue;
            }

            throw e;
        }
    }
};

export function getUidAndGidInSandbox(rootfs: string, username: string): { uid: number; gid: number } {
    try {
        return nativeAddon.getUidAndGidInSandbox(rootfs, username);
    } catch (e) {
        throw e;
    }
}
