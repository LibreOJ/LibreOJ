import { SandboxParameter, SandboxResult, SandboxStatus } from './interfaces';
import sandboxAddon from './nativeAddon';
import * as utils from './utils';

export class SandboxProcess {
    private readonly cancellationToken: NodeJS.Timer = null;
    private readonly stopCallback: () => void;

    private countedCpuTime: number = 0;
    private actualCpuTime: number = 0;
    private timeout: boolean = false;
    private cancelled: boolean = false;
    private waitPromise: Promise<SandboxResult> = null;

    public running: boolean = true;

    constructor(
        public readonly parameter: SandboxParameter,
        public readonly pid: number,
        private readonly execution: any
    ) {
        const myFather = this;
        // Stop the sandboxed process on Node.js exit.
        this.stopCallback = () => {
            myFather.stop();
        }

        let checkIfTimedOut = () => { };
        if (this.parameter.time !== -1) {
            // Check every 50ms.
            const checkInterval = Math.min(this.parameter.time / 10, 50);
            let lastCheck = new Date().getTime();
            checkIfTimedOut = () => {
                let current = new Date().getTime();
                const spent = current - lastCheck;
                lastCheck = current;
                const val = Number(sandboxAddon.readSandboxStats(myFather.execution).cpuTimeNanoseconds);
                myFather.countedCpuTime += Math.max(
                    val - myFather.actualCpuTime,  // The real time, or if less than 40%,
                    utils.milliToNano(spent) * 0.4 // 40% of actually elapsed time
                );
                myFather.actualCpuTime = val;

                // Time limit exceeded
                if (myFather.countedCpuTime > utils.milliToNano(parameter.time)) {
                    myFather.timeout = true;
                    myFather.stop();
                }
            };
            this.cancellationToken = setInterval(checkIfTimedOut, checkInterval);
        }

        this.waitPromise = new Promise((res, rej) => {
            sandboxAddon.waitForProcess(execution, (err, runResult) => {
                if (err) {
                    try {
                        myFather.stop();
                        myFather.cleanup(true);
                    } catch (e) {
                        console.log("Error cleaning up error sandbox:", e);
                    }
                    rej(err);
                } else {
                    try {
                        const stats = myFather.parseStats(sandboxAddon.finalizeSandboxCgroup(myFather.execution));
                        myFather.cleanup(false);
                        myFather.actualCpuTime = stats.cpuTime;

                        const result: SandboxResult = {
                            status: SandboxStatus.Unknown,
                            time: myFather.actualCpuTime,
                            memory: stats.memoryPeak,
                            code: runResult.code
                        };

                        if (
                            myFather.timeout ||
                            (myFather.parameter.time !== -1 &&
                                myFather.actualCpuTime > utils.milliToNano(myFather.parameter.time))
                        ) {
                            result.status = SandboxStatus.TimeLimitExceeded;
                        } else if (myFather.cancelled) {
                            result.status = SandboxStatus.Cancelled;
                        } else if (
                            stats.oomKills > 0 ||
                            (myFather.parameter.memory != -1 && stats.memoryPeak > myFather.parameter.memory)
                        ) {
                            result.status = SandboxStatus.MemoryLimitExceeded;
                        } else if (runResult.status === 'signaled') {
                            result.status = SandboxStatus.RuntimeError;
                        } else if (runResult.status === 'exited') {
                            result.status = SandboxStatus.OK;
                        }

                        res(result);
                    } catch (e) {
                        rej(e);
                    }
                }
            })
        });
    }

    private parseStats(stats: any): { cpuTime: number; memoryPeak: number; oomKills: number } {
        return {
            cpuTime: Number(stats.cpuTimeNanoseconds),
            memoryPeak: Number(stats.memoryPeakBytes),
            oomKills: Number(stats.oomKillCount)
        };
    }

    private cleanup(removeCgroup: boolean): void {
        if (this.running) {
            if (this.cancellationToken) {
                clearInterval(this.cancellationToken);
            }
            process.removeListener('exit', this.stopCallback);
            if (removeCgroup) {
                sandboxAddon.removeSandboxCgroup(this.execution);
            }
            this.running = false;
        }
    }

    stop(): void {
        this.cancelled = true;
        try {
            sandboxAddon.killSandbox(this.execution);
        } catch (err) {}
    }

    async waitForStop(): Promise<SandboxResult> {
        return await this.waitPromise;
    }
};
