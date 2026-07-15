const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { SandboxStatus, getUidAndGidInSandbox, startSandbox } = require("../lib");

if (process.getuid() !== 0) throw new Error("The sandbox demo must run as root inside a delegated systemd unit");

const sandboxUid = 12345;
const sandboxGid = 12345;
const root = fs.mkdtempSync(path.join(os.tmpdir(), "simple-sandbox-demo-"));
const rootfs = path.join(root, "rootfs");
const binary = path.join(root, "binary");
const working = path.join(root, "working");
const executable = "/sandbox/binary/fixture";
const firstAllowedCpu = Number(fs.readFileSync("/proc/self/status", "utf8").match(/^Cpus_allowed_list:\s*(\d+)/m)?.[1]);
if (!Number.isInteger(firstAllowedCpu)) throw new Error("Cannot determine the first allowed CPU");

const createDirectory = (directory, mode = 0o755) => fs.mkdirSync(directory, { recursive: true, mode });

const prepareFilesystem = () => {
  for (const directory of [
    path.join(rootfs, "dev"),
    path.join(rootfs, "etc"),
    path.join(rootfs, "proc"),
    path.join(rootfs, "sandbox", "binary"),
    path.join(rootfs, "sandbox", "working"),
    path.join(rootfs, "tmp"),
    binary,
    working
  ]) {
    createDirectory(directory);
  }
  fs.writeFileSync(
    path.join(rootfs, "etc", "passwd"),
    `root:x:0:0:root:/root:/bin/false\nsandbox:x:${sandboxUid}:${sandboxGid}:sandbox:/sandbox:/bin/false\n`
  );
  fs.chownSync(working, sandboxUid, sandboxGid);
  fs.chmodSync(working, 0o755);

  const compilation = childProcess.spawnSync(
    "cc",
    ["-O2", "-static", path.join(__dirname, "fixture.c"), "-o", path.join(binary, "fixture")],
    { encoding: "utf8" }
  );
  if (compilation.status !== 0) throw new Error(`Fixture compilation failed:\n${compilation.stderr}`);
  fs.chmodSync(binary, 0o777);
  fs.chmodSync(path.join(binary, "fixture"), 0o755);
};

const readDelegatedRoot = () => {
  const ownCgroup = fs
    .readFileSync("/proc/self/cgroup", "utf8")
    .split("\n")
    .find(line => line.startsWith("0::"));
  if (!ownCgroup) throw new Error("The demo is not running in a unified cgroup hierarchy");
  const ownPath = ownCgroup.slice(3);
  if (path.basename(ownPath) !== "supervisor") throw new Error("The demo requires DelegateSubgroup=supervisor");
  return path.join("/sys/fs/cgroup", path.dirname(ownPath));
};

const listSandboxCgroups = delegatedRoot =>
  fs
    .readdirSync(delegatedRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith("sandbox-"))
    .map(entry => entry.name)
    .sort();

let sequence = 0;
const run = async (name, fixtureArguments, overrides = {}, afterStart) => {
  const directory = path.join(working, `${++sequence}-${name}`);
  createDirectory(directory);
  fs.chownSync(directory, sandboxUid, sandboxGid);
  const input = path.join(directory, "input.txt");
  fs.writeFileSync(input, "demo input\n");
  fs.chownSync(input, sandboxUid, sandboxGid);

  const resolvedOverrides = typeof overrides === "function" ? overrides({ directory, input }) : overrides;
  const parameter = {
    time: 1000,
    memory: 64 * 1024 * 1024,
    process: 16,
    chroot: rootfs,
    hostname: "sandbox-demo",
    mounts: [
      { src: binary, dst: "/sandbox/binary", limit: 0 },
      { src: working, dst: "/sandbox/working", limit: -1 }
    ],
    redirectBeforeChroot: false,
    mountProc: true,
    executable,
    stdin: path.relative(working, input),
    stdout: path.relative(working, path.join(directory, "stdout.txt")),
    stderr: path.relative(working, path.join(directory, "stderr.txt")),
    user: { uid: sandboxUid, gid: sandboxGid },
    parameters: [executable, ...fixtureArguments],
    environments: ["DEMO_VALUE=works"],
    workingDirectory: "/sandbox/working",
    stackSize: 8 * 1024 * 1024,
    cpuAffinity: [firstAllowedCpu],
    ...resolvedOverrides
  };

  const sandbox = startSandbox(parameter);
  if (afterStart) await afterStart(sandbox);
  const result = await sandbox.waitForStop();
  const stdout = fs.existsSync(path.join(directory, "stdout.txt"))
    ? fs.readFileSync(path.join(directory, "stdout.txt"), "utf8")
    : "";
  const stderr = fs.existsSync(path.join(directory, "stderr.txt"))
    ? fs.readFileSync(path.join(directory, "stderr.txt"), "utf8")
    : "";
  return { result, stdout, stderr, sandbox };
};

const runDemo = async () => {
  prepareFilesystem();
  const delegatedRoot = readDelegatedRoot();
  const initialCgroups = listSandboxCgroups(delegatedRoot);

  assert.deepEqual(getUidAndGidInSandbox(rootfs, "sandbox"), { uid: sandboxUid, gid: sandboxGid });

  const inspection = await run("inspect", ["inspect"]);
  assert.equal(inspection.result.status, SandboxStatus.OK);
  assert.equal(inspection.result.code, 0);
  assert(inspection.result.time >= 0);
  assert(inspection.result.memory > 0);
  assert.match(inspection.stdout, /^uid=12345$/m);
  assert.match(inspection.stdout, /^gid=12345$/m);
  assert.match(inspection.stdout, /^hostname=sandbox-demo$/m);
  assert.match(inspection.stdout, /^environment=works$/m);
  assert.match(inspection.stdout, /^working_directory=\/sandbox\/working$/m);
  assert.match(inspection.stdout, /^stdin=demo input$/m);
  assert.match(inspection.stdout, /^proc=available$/m);
  assert.match(inspection.stdout, new RegExp(`^affinity=${firstAllowedCpu}$`, "m"));
  assert.match(inspection.stdout, /^readonly=EROFS$/m);
  assert.match(inspection.stdout, /^stack_limit=8388608$/m);
  assert.equal(fs.readFileSync(path.join(working, "created-by-sandbox"), "utf8"), "created\n");
  inspection.sandbox.stop();

  const outsideRedirection = await run("outside-redirection", ["inspect"], ({ directory, input }) => ({
    redirectBeforeChroot: true,
    stdin: input,
    stdout: path.join(directory, "stdout.txt"),
    stderr: path.join(directory, "stderr.txt")
  }));
  assert.equal(outsideRedirection.result.status, SandboxStatus.OK);
  assert.match(outsideRedirection.stdout, /^stdin=demo input$/m);

  const descriptorInput = fs.openSync(path.join(working, "1-inspect", "input.txt"), "r");
  const descriptorOutputPath = path.join(root, "descriptor-output.txt");
  const descriptorOutput = fs.openSync(descriptorOutputPath, "w");
  try {
    const descriptorRedirection = await run("descriptor-redirection", ["inspect"], {
      stdin: descriptorInput,
      stdout: descriptorOutput,
      stderr: descriptorOutput
    });
    assert.equal(descriptorRedirection.result.status, SandboxStatus.OK);
  } finally {
    fs.closeSync(descriptorInput);
    fs.closeSync(descriptorOutput);
  }
  assert.match(fs.readFileSync(descriptorOutputPath, "utf8"), /^stdin=demo input$/m);

  const minimal = await run("minimal", ["exit", "0"], {
    hostname: undefined,
    mountProc: false,
    stdin: undefined,
    stdout: undefined,
    stderr: undefined,
    stackSize: undefined,
    cpuAffinity: []
  });
  assert.equal(minimal.result.status, SandboxStatus.OK);

  const nonzero = await run("nonzero", ["exit", "23"]);
  assert.equal(nonzero.result.status, SandboxStatus.OK);
  assert.equal(nonzero.result.code, 23);

  const signaled = await run("signaled", ["signal"]);
  assert.equal(signaled.result.status, SandboxStatus.RuntimeError);

  const timedOut = await run("cpu", ["cpu"], { time: 100 });
  assert.equal(timedOut.result.status, SandboxStatus.TimeLimitExceeded);

  const memoryLimited = await run("memory", ["memory", String(64 * 1024 * 1024)], {
    memory: 16 * 1024 * 1024
  });
  assert.equal(memoryLimited.result.status, SandboxStatus.MemoryLimitExceeded);

  const processLimited = await run("pids", ["pids"], { process: 4 });
  assert.equal(processLimited.result.status, SandboxStatus.OK);
  assert.match(processLimited.stdout, /^forked=3$/m);

  const unlimited = await run("unlimited", ["exit", "0"], { time: -1, memory: -1, process: -1 });
  assert.equal(unlimited.result.status, SandboxStatus.OK);

  const cancellation = await run("cancellation", ["descendants"], { time: -1 }, async sandbox => {
    await new Promise(resolve => setTimeout(resolve, 100));
    sandbox.stop();
  });
  assert.equal(cancellation.result.status, SandboxStatus.Cancelled);

  const concurrent = await Promise.all(
    Array.from({ length: 4 }, (_, index) => run(`concurrent-${index}`, ["exit", "0"]))
  );
  assert(concurrent.every(({ result }) => result.status === SandboxStatus.OK));

  await assert.rejects(
    startSandbox({
      time: 100,
      memory: 16 * 1024 * 1024,
      process: 4,
      chroot: rootfs,
      hostname: "sandbox-demo",
      mounts: [],
      redirectBeforeChroot: false,
      mountProc: false,
      executable: "/does-not-exist",
      user: { uid: sandboxUid, gid: sandboxGid },
      parameters: ["/does-not-exist"],
      environments: [],
      workingDirectory: "/",
      cpuAffinity: [firstAllowedCpu]
    }).waitForStop(),
    /child process/
  );

  assert.deepEqual(listSandboxCgroups(delegatedRoot), initialCgroups);
  process.stdout.write("simple-sandbox cgroup v2 demo passed\n");
};

runDemo()
  .finally(() => fs.rmSync(root, { recursive: true, force: true }))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
