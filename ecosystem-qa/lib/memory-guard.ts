import { appendFileSync } from 'node:fs';

import { STALLED_PERCENT, type HostSample, type Report } from './host-watch.ts';

export interface SandboxProcess {
  pid: number;
  parent: number;
  rssMb: number;
  command: string;
}

export interface Command {
  // The process the command began with, and the one of its processes that holds the most memory.
  started: SandboxProcess;
  largest: SandboxProcess;
  pids: number[];
  rssMb: number;
}

// The table that `ps -eo pid=,ppid=,rss=,args=` prints, with the memory in kB.
export const parseProcesses = (table: string): SandboxProcess[] =>
  table.split('\n').flatMap((line) => {
    const [, pid, parent, rss, command] = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/.exec(line) ?? [];
    return command
      ? [
          {
            pid: Number(pid),
            parent: Number(parent),
            rssMb: Math.round(Number(rss) / 1024),
            command: command.trim(),
          },
        ]
      : [];
  });

const programOf = (command: string) => command.split(/\s+/)[0]?.split('/').at(-1);

const isAgent =
  (agent: string) =>
  ({ command }: SandboxProcess): boolean =>
    programOf(command) === agent;

// The wrapper that times the project install and records how it ended. Ending it with the install
// would leave no record, and the run would fail on that instead of on the install.
const isInstallTimer = ({ command }: SandboxProcess): boolean =>
  /(^|[\s/])timed\.mjs(\s|$)/.test(command);

// Pick what to end in a sandbox that has no memory left: the command that holds the most of it,
// with every process it started.
//
// A command begins at a process the runner's own processes started, or at one that outlived the
// shell that started it. The runner's own are the agent, whose session is the run, and the timer of
// the install. They and the processes they descend from belong to no command, and neither does the
// first process of the sandbox, which keeps the sandbox alive.
export const heaviestCommand = (
  processes: SandboxProcess[],
  agent: string
): Command | undefined => {
  const byPid = new Map(processes.map((process) => [process.pid, process]));
  const kept = new Set([1]);
  for (const process of processes) {
    if (!isAgent(agent)(process) && !isInstallTimer(process)) {
      continue;
    }
    for (
      let current: SandboxProcess | undefined = process;
      current && !kept.has(current.pid);
      current = byPid.get(current.parent)
    ) {
      kept.add(current.pid);
    }
  }
  const commands = new Map<number, Command>();
  for (const process of processes.filter(({ pid }) => !kept.has(pid))) {
    let started = process;
    for (
      let parent = byPid.get(started.parent);
      parent && !kept.has(parent.pid);
      parent = byPid.get(started.parent)
    ) {
      started = parent;
    }
    const command = commands.get(started.pid) ?? { started, largest: process, pids: [], rssMb: 0 };
    commands.set(started.pid, {
      started,
      largest: process.rssMb > command.largest.rssMb ? process : command.largest,
      pids: [...command.pids, process.pid],
      rssMb: command.rssMb + process.rssMb,
    });
  }
  return [...commands.values()].sort((a, b) => b.rssMb - a.rssMb)[0];
};

interface Guard {
  // The name of the agent's own program in the sandbox, which is never ended.
  agent: string;
  // Whether the agent has been started. From then on the guard ends nothing in a sandbox in which
  // it cannot find the agent, because it could not tell the agent from a command.
  agentStarted: () => boolean;
  // Run a program in the sandbox and hand over what it prints, or nothing when it fails.
  inSandbox: (container: string, command: string[]) => Promise<string>;
  // A file the agent can read, so that it learns why its command ended.
  logFile: string;
  report: (report: Report) => void;
}

const short = (command: string) => (command.length > 160 ? `${command.slice(0, 160)}...` : command);

// The limit of the sandbox does not cover what the machine holds outside it. On a GitHub runner the
// agent of the runner hardening step grew by a gigabyte a minute while a project's tests ran in a
// browser, and a machine that runs out of memory and swap stops answering and hands over nothing.
// Below 15% of its memory in what is available and what is left of the swap, the machine is
// about a minute away from that. A sandbox that is merely full leaves less than that on a machine
// without swap, so the machine also has to have lost part of the share the sandbox was given.
const machineIsShort = (sample: HostSample): boolean =>
  sample.container !== undefined &&
  sample.memTotalMb > 0 &&
  sample.memAvailableMb + sample.swapFreeMb < sample.memTotalMb * 0.15 &&
  sample.memAvailableMb + sample.container.memUsedMb < sample.container.memLimitMb;

// End the command that holds the most memory once a sandbox at its memory limit has stalled in two
// readings in a row, or at once when the machine itself is about to run out.
//
// The kernel ends a process of a sandbox at its memory limit only when it can free nothing at all.
// While it can still take the code of the processes out of memory and read it back from the disk,
// it does that, and a build that needs more than the sandbox has neither fails nor moves on.
// Ending the command gives the agent the exit status it would have got from the kernel.
export const memoryGuard = (guard: Guard) => {
  let stalledReadings = 0;
  const said = new Set<string>();
  // A job step keeps ten warnings, so each kind of line is a warning once and a log line after.
  const say = (kind: string, line: string) => {
    guard.report({ level: said.has(kind) ? 'log' : 'warning', line });
    said.add(kind);
  };
  return async (sample: HostSample, container: string | undefined): Promise<void> => {
    const sandbox = sample.container;
    const waiting = sandbox?.stalledNowPercent ?? 0;
    // Processes also wait for memory when the whole machine is short. Ending a command only helps
    // a sandbox that is at its own limit.
    const stalled =
      sandbox !== undefined &&
      waiting >= STALLED_PERCENT &&
      sandbox.memUsedMb >= sandbox.memLimitMb * 0.9;
    stalledReadings = container && stalled ? stalledReadings + 1 : 0;
    const machineShort = machineIsShort(sample);
    if (!container || !sandbox || (!machineShort && stalledReadings < 2)) {
      return;
    }
    stalledReadings = 0;
    const state = machineShort
      ? `Minute ${sample.minute}: the machine had ${sample.memAvailableMb} MB of memory and ${sample.swapFreeMb} MB of swap left.`
      : `Minute ${sample.minute}: the sandbox had no memory left, and its processes waited for memory in ${Math.round(waiting)}% of the last ten seconds.`;
    const processes = parseProcesses(
      await guard.inSandbox(container, ['ps', '-eo', 'pid=,ppid=,rss=,args='])
    );
    if (processes.length === 0) {
      say('unlisted', `${state} The runner could not list its processes, so it ended nothing.`);
      return;
    }
    if (guard.agentStarted() && !processes.some(isAgent(guard.agent))) {
      say(
        'no-agent',
        `${state} The runner did not find the agent among its processes, so it ended nothing.`
      );
      return;
    }
    const command = heaviestCommand(processes, guard.agent);
    // Ending a command that holds less than a tenth of the memory would not end the stall.
    if (!command || command.rssMb * 10 < sandbox.memLimitMb) {
      return;
    }
    const line = `${state} The runner ends the command that holds the most, ${command.rssMb} MB in ${command.pids.length} process(es): ${short(command.started.command)}${command.largest === command.started ? '' : `. Its largest process, with ${command.largest.rssMb} MB: ${short(command.largest.command)}`}`;
    // Written first: the agent looks for it the moment its command returns.
    appendFileSync(guard.logFile, `${line}\n`);
    await guard.inSandbox(container, ['kill', '-KILL', ...command.pids.map(String)]);
    say('ended', line);
  };
};
