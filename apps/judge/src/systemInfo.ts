import os from "os";

import systeminformation from "systeminformation";
import { JudgeClientSystemInfo } from "@libreoj/judge-protocol";

let cachedResult: JudgeClientSystemInfo;

export default async function getSystemInfo(): Promise<JudgeClientSystemInfo> {
  if (cachedResult) return cachedResult;

  const [osInfo, cpu, cpuFlags, mem, memLayout] = await Promise.all([
    systeminformation.osInfo(),
    systeminformation.cpu(),
    systeminformation.cpuFlags(),
    systeminformation.mem(),
    systeminformation.memLayout()
  ]);

  const memory =
    memLayout.reduce((max, val) => (max.size > val.size ? max : val), memLayout[0]) || ({} as typeof memLayout[0]);

  const cpuCores = [cpu.physicalCores, cpu.cores].find(x => Number.isSafeInteger(x));

  // eslint-disable-next-line no-return-assign
  return (cachedResult = {
    os: osInfo.distro + (osInfo.release === "unknown" ? "" : ` ${osInfo.release}`),
    kernel: `${os.type().split("_").join(" ")} ${os.release()}`,
    arch: osInfo.arch,
    cpu: {
      model: [cpu.manufacturer, cpu.brand, "@", cpuCores && `${cpuCores}x`, `${cpu.speedMax || cpu.speed}GHz`]
        .filter(x => x)
        .join(" "),
      flags: cpuFlags,
      cache: Object.fromEntries(
        Object.entries(cpu.cache)
          .filter(([, size]) => size)
          .map(([cache, size]) => [cache.replace("l", "L"), size])
      )
    },
    memory: {
      size: mem.total / 1024,
      description: [memory.formFactor, memory.type, memory.clockSpeed && `${memory.clockSpeed}MHz`]
        .filter(x => x)
        .join(" ")
    },
    languages: {},
    extraInfo: ""
  });
}
