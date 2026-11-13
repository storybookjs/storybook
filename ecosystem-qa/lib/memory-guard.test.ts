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

// A sandbox in which the agent runs a build in one Bash call and has a dev server that outlived
// the call that started it.
const TABLE = [
  '      1       0   1024 sleep infinity',
  '    298       0   1536 sh -c claude --print --verbose --output-format stream-json -p -',
  '    304     298 195316 claude --print --verbose --output-format stream-json -p -',
  '   5787       1  27892 npm exec storybook dev -c . --ci --exact-port -p 6006',
  '   5803    5787 1481324 node /home/agent/workspace/storybook/node_modules/.bin/storybook dev -c . --ci',
  '   6397     304    364 /bin/bash -c timeout 900 npm run build > build.log 2>&1; echo "exit=$?"',
  '   6398    6397    512 timeout 900 npm run build',
  '   6399    6398  20440 npm run build',
  '   6423    6399  12700 node ./build.mjs',
  '   7301    6423 4931476 node /home/agent/workspace/tools/build-scripts/node_modules/.bin/wp-build',
  '   7343    7301  57480 /home/agent/workspace/node_modules/sass-embedded-linux-arm64/dart-sass/src/dart',
  '   7522       0   2804 ps -eo pid=,ppid=,rss=,args=',
].join('\n');

describe('parseProcesses', () => {
  it('reads the process, its parent, its memory in MB and its whole command line', () => {
    expect(parseProcesses(TABLE)).toHaveLength(12);
    expect(parseProcesses(TABLE)[5]).toEqual({
      pid: 6397,
      parent: 304,
      rssMb: 0,
      command: '/bin/bash -c timeout 900 npm run build > build.log 2>&1; echo "exit=$?"',
    });
    expect(parseProcesses('')).toEqual([]);
  });
});

describe('heaviestCommand', () => {
  it('picks the Bash call of the agent whose processes hold the most, with all it started', () => {
    const command = heaviestCommand(parseProcesses(TABLE), 'claude');

    expect(command?.pids).toEqual([6397, 6398, 6399, 6423, 7301, 7343]);
    expect(command?.started.pid).toBe(6397);
    expect(command?.largest.pid).toBe(7301);
    expect(command?.rssMb).toBe(4905);
  });

  it('never picks the agent, what the agent descends from, or the first process', () => {
    const agentOnly = parseProcesses(TABLE).filter(({ pid }) => [1, 298, 304].includes(pid));

    expect(heaviestCommand(agentOnly, 'claude')).toBeUndefined();
  });

  it('takes a server that outlived its shell as a command of its own', () => {
    const withoutBuild = parseProcesses(TABLE).filter(({ pid }) => pid < 6397 || pid === 7522);

    expect(heaviestCommand(withoutBuild, 'claude')?.pids).toEqual([5787, 5803]);
  });
});

describe('memoryGuard', () => {
  const reading = (stalledNowPercent: number, minute = 19): HostSample => ({
    minute,
    memTotalMb: 7932,
    memAvailableMb: 650,
    swapTotalMb: 0,
    swapFreeMb: 0,
    cpus: 4,
    diskFreeMb: 80_000,
    container: { memUsedMb: 6716, memLimitMb: 6742, cpuPercent: 900, pids: 263, stalledNowPercent },
  });

  const guardWith = (table = TABLE) => {
    const calls: string[][] = [];
    const logAtKill: boolean[] = [];
    const report = vi.fn();
    const guard = memoryGuard({
      agent: 'claude',
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

  it('ends the heaviest command after two stalled readings in a row, and says which', async () => {
    const { guard, kills, report, logAtKill } = guardWith();

    await guard(reading(85), 'sandbox');
    await guard(reading(32, 20), 'sandbox');

    expect(kills()).toEqual([['kill', '-KILL', '6397', '6398', '6399', '6423', '7301', '7343']]);
    const line =
      'Minute 20: the sandbox had no memory left, and its processes waited for memory in 32% of the last ten seconds. The runner ends the command that holds the most, 4905 MB in 6 process(es): /bin/bash -c timeout 900 npm run build > build.log 2>&1; echo "exit=$?". Its largest process, with 4816 MB: node /home/agent/workspace/tools/build-scripts/node_modules/.bin/wp-build';
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

  it('ends nothing when no command holds a tenth of the memory', async () => {
    const small = TABLE.split('\n')
      .filter((line) => !/ (5803|7301) /.test(line))
      .join('\n');
    const { guard, kills } = guardWith(small);

    await guard(reading(85), 'sandbox');
    await guard(reading(85), 'sandbox');

    expect(kills()).toEqual([]);
  });

  it('leaves a run without a sandbox container alone', async () => {
    const { guard, kills } = guardWith();

    await guard(reading(85), undefined);
    await guard(reading(85), undefined);

    expect(kills()).toEqual([]);
  });
});
