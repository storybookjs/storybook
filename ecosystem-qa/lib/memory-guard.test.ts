import { appendFileSync } from 'node:fs';

import { fs as memfs, vol } from 'memfs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HostSample } from './host-watch.ts';
import { heaviestCommand, memoryGuard, parseProcesses } from './memory-guard.ts';

vi.mock('node:fs', { spy: true });

beforeEach(() => {
  vol.reset();
  vol.mkdirSync('/evidence', { recursive: true });
  vi.mocked(appendFileSync).mockImplementation(memfs.appendFileSync as typeof appendFileSync);
});

// Modelled on the process table of a gutenberg run whose package build filled the sandbox. The
// rows of the agent, the build and the dev server are as `ps` printed them; the short-lived shells
// between them, which that listing did not show, are filled in.
const TABLE = [
  '      1       0   1024 sleep infinity',
  '    298       0   1536 sh -c claude --print --verbose --dangerously-skip-permissions -p -',
  '    304     298 195316 claude --print --verbose --dangerously-skip-permissions --output-format stream-json --model claude-haiku-5-5 --effort low -p -',
  '   5787       1  27892 npm exec storybook dev -c . --ci --exact-port -p 6006',
  '   5802    5787   1024 sh -c storybook dev -c . --ci --exact-port -p 6006',
  '   5803    5802 1481324 node /home/agent/workspace/storybook/node_modules/.bin/storybook dev -c . --ci --exact-port -p 6006',
  '   6397     304    364 /bin/bash -c source /home/agent/.claude/shell-snapshots/snapshot-bash.sh && timeout 900 npm run build',
  '   6398    6397   1024 timeout 900 npm run build',
  '   6399    6398  20440 npm run build',
  '   6410    6399   1024 sh -c npm run --workspace @wordpress/build-scripts build:all --',
  '   6411    6410  28648 npm run build:all',
  '   6422    6411   1024 sh -c node ./build.mjs',
  '   6423    6422  12700 node ./build.mjs',
  '   7301    6423 4931476 node /home/agent/workspace/tools/build-scripts/node_modules/.bin/wp-build',
  '   7343    7301  57480 /home/agent/workspace/node_modules/.store/sass-embedded-linux-arm64/dart-sass/src/dart',
  '   7522       0   2804 ps -eo pid=,ppid=,rss=,args=',
].join('\n');

// The project install, which runs before there is an agent.
const INSTALL = [
  '      1       0   1024 sleep infinity',
  '     40       0   1536 sh -c node "/tools/timed.mjs" --use-node --limit-seconds=1500 /home/agent/qa-evidence/install-seconds.txt npm ci',
  '     41      40  61440 node /tools/timed.mjs --use-node --limit-seconds=1500 /home/agent/qa-evidence/install-seconds.txt npm ci',
  '     52      41 2621440 npm ci',
  '     60      52 1048576 node /home/agent/workspace/node_modules/esbuild/install.js',
].join('\n');

describe('parseProcesses', () => {
  it('reads the process, its parent, its memory in MB and its whole command line', () => {
    expect(parseProcesses(TABLE)).toHaveLength(16);
    expect(parseProcesses(TABLE)[7]).toEqual({
      pid: 6398,
      parent: 6397,
      rssMb: 1,
      command: 'timeout 900 npm run build',
    });
    expect(parseProcesses('')).toEqual([]);
  });
});

describe('heaviestCommand', () => {
  it('picks the Bash call of the agent whose processes hold the most, with all it started', () => {
    const command = heaviestCommand(parseProcesses(TABLE), 'claude');

    expect(command?.pids).toEqual([6397, 6398, 6399, 6410, 6411, 6422, 6423, 7301, 7343]);
    expect(command?.started.pid).toBe(6397);
    expect(command?.largest.pid).toBe(7301);
    expect(command?.rssMb).toBe(4935);
  });

  it('never picks the agent, what the agent descends from, or the first process', () => {
    const agentOnly = parseProcesses(TABLE).filter(({ pid }) => [1, 298, 304].includes(pid));

    expect(heaviestCommand(agentOnly, 'claude')).toBeUndefined();
  });

  it('knows an agent that a wrapper of another name started', () => {
    const codex = parseProcesses(
      [
        '      1       0   1024 sleep infinity',
        '    300       0  81920 node /usr/local/bin/codex exec --json -',
        '    310     300 204800 /usr/local/lib/node_modules/@openai/codex/vendor/x86_64-unknown-linux-musl/codex/codex exec --json -',
        '    400     310   1024 bash -lc npm run build',
        '    401     400 3145728 node build.js',
      ].join('\n')
    );

    expect(heaviestCommand(codex, 'codex')?.pids).toEqual([400, 401]);
  });

  it('takes a server that outlived its shell as a command of its own', () => {
    const withoutBuild = parseProcesses(TABLE).filter(({ pid }) => pid < 6397 || pid === 7522);

    expect(heaviestCommand(withoutBuild, 'claude')?.pids).toEqual([5787, 5802, 5803]);
  });

  it('picks the install and not the timer that records how the install ended', () => {
    const command = heaviestCommand(parseProcesses(INSTALL), 'claude');

    expect(command?.pids).toEqual([52, 60]);
    expect(command?.started.command).toBe('npm ci');
  });
});

describe('memoryGuard', () => {
  const reading = (
    stalledNowPercent: number,
    { minute = 19, memUsedMb = 6716, memAvailableMb = 650 } = {}
  ): HostSample => ({
    minute,
    memTotalMb: 7932,
    memAvailableMb,
    swapTotalMb: 0,
    swapFreeMb: 0,
    cpus: 4,
    diskFreeMb: 80_000,
    container: { memUsedMb, memLimitMb: 6742, cpuPercent: 900, pids: 263, stalledNowPercent },
  });

  const guardWith = ({ table = TABLE, agentStarted = true } = {}) => {
    const calls: string[][] = [];
    const logAtKill: boolean[] = [];
    const report = vi.fn();
    const guard = memoryGuard({
      agent: 'claude',
      agentStarted: () => agentStarted,
      inSandbox: async (_container, command) => {
        calls.push(command);
        if (command[0] === 'kill') {
          logAtKill.push(vol.existsSync('/evidence/memory-guard.log'));
        }
        return command[0] === 'ps' ? table : '';
      },
      logFile: '/evidence/memory-guard.log',
      report,
    });
    const kills = () => calls.filter(([program]) => program === 'kill');
    return { guard, kills, report, logAtKill };
  };

  it('ends nothing after one reading of a stalled sandbox', async () => {
    const { guard, kills } = guardWith();

    await guard(reading(85), 'sandbox');

    expect(kills()).toEqual([]);
  });

  it('ends the heaviest command after two stalled readings in a row, and says which before it does', async () => {
    const { guard, kills, report, logAtKill } = guardWith();

    await guard(reading(85), 'sandbox');
    await guard(reading(32, { minute: 20 }), 'sandbox');

    expect(kills()).toEqual([
      ['kill', '-KILL', '6397', '6398', '6399', '6410', '6411', '6422', '6423', '7301', '7343'],
    ]);
    const line =
      'Minute 20: the sandbox had no memory left, and its processes waited for memory in 32% of the last ten seconds. The runner ends the command that holds the most, 4935 MB in 9 process(es): /bin/bash -c source /home/agent/.claude/shell-snapshots/snapshot-bash.sh && timeout 900 npm run build. Its largest process, with 4816 MB: node /home/agent/workspace/tools/build-scripts/node_modules/.bin/wp-build';
    expect(report).toHaveBeenCalledWith({ level: 'warning', line });
    expect(vol.readFileSync('/evidence/memory-guard.log', 'utf8')).toBe(`${line}\n`);
    expect(logAtKill).toEqual([true]);
  });

  it('starts counting again after a reading without a stall, and after it ended a command', async () => {
    const { guard, kills } = guardWith();

    await guard(reading(85), 'sandbox');
    await guard(reading(3), 'sandbox');
    await guard(reading(85), 'sandbox');
    expect(kills()).toHaveLength(0);

    await guard(reading(85), 'sandbox');
    expect(kills()).toHaveLength(1);

    await guard(reading(85), 'sandbox');
    expect(kills()).toHaveLength(1);
  });

  it('ends nothing in a sandbox that waits for memory without being at its own limit', async () => {
    const { guard, kills } = guardWith();

    const waiting = reading(85, { memUsedMb: 3000, memAvailableMb: 4000 });

    await guard(waiting, 'sandbox');
    await guard(waiting, 'sandbox');

    expect(kills()).toEqual([]);
  });

  it('ends nothing when no command holds a tenth of the memory', async () => {
    const small = TABLE.split('\n')
      .filter((line) => !/ (5803|7301) /.test(line))
      .join('\n');
    const { guard, kills } = guardWith({ table: small });

    await guard(reading(85), 'sandbox');
    await guard(reading(85), 'sandbox');

    expect(kills()).toEqual([]);
  });

  it('ends nothing once the agent runs and is not among the processes, and says so', async () => {
    const unknownAgent = TABLE.replaceAll(' claude --print', ' /opt/agent/bin/cli --print');
    const { guard, kills, report } = guardWith({ table: unknownAgent });

    await guard(reading(85), 'sandbox');
    await guard(reading(85), 'sandbox');

    expect(kills()).toEqual([]);
    expect(report).toHaveBeenCalledWith({
      level: 'warning',
      line: 'Minute 19: the sandbox had no memory left, and its processes waited for memory in 85% of the last ten seconds. The runner did not find the agent among its processes, so it ended nothing.',
    });
  });

  it('ends the install before there is an agent, and leaves its timer', async () => {
    const { guard, kills } = guardWith({ table: INSTALL, agentStarted: false });

    await guard(reading(85), 'sandbox');
    await guard(reading(85), 'sandbox');

    expect(kills()).toEqual([['kill', '-KILL', '52', '60']]);
  });

  it('ends the heaviest command at once when the machine itself is about to run out', async () => {
    const { guard, kills, report } = guardWith();
    const runner = {
      ...reading(0, { memUsedMb: 5300 }),
      memTotalMb: 15_983,
      memAvailableMb: 700,
      swapTotalMb: 3072,
      swapFreeMb: 800,
    };

    await guard({ ...runner, swapFreeMb: 1000 }, 'sandbox');
    expect(kills()).toEqual([]);

    await guard(runner, 'sandbox');

    expect(kills()).toHaveLength(1);
    expect(report).toHaveBeenCalledWith({
      level: 'warning',
      line: expect.stringMatching(
        /^Minute 19: the machine had 700 MB of memory and 800 MB of swap left\. The runner ends the command that holds the most, 4935 MB in 9 process\(es\): /
      ),
    });
  });

  it('leaves a machine without swap alone when the sandbox is merely full', async () => {
    const { guard, kills } = guardWith();

    await guard(reading(0), 'sandbox');
    await guard(reading(0), 'sandbox');

    expect(kills()).toEqual([]);
  });

  it('leaves a run without a sandbox container alone', async () => {
    const { guard, kills } = guardWith();

    await guard(reading(85), undefined);
    await guard(reading(85), undefined);

    expect(kills()).toEqual([]);
  });
});
