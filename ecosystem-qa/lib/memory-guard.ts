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

// Pick what to end in a sandbox that has no memory left: the command that holds the most of it,
// with every process it started.
//
// A command begins at a process the agent started, or at one that outlived the shell that started
// it. The agent and the processes it descends from belong to no command, because its session is the
// run, and neither does the first process of the sandbox, which keeps the sandbox alive.
export const heaviestCommand = (
  processes: SandboxProcess[],
  agent: string
): Command | undefined => {
  const byPid = new Map(processes.map((process) => [process.pid, process]));
  const kept = new Set([1]);
  for (const process of processes.filter(({ command }) => programOf(command) === agent)) {
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
  // Run a program in the sandbox and hand over what it prints, or nothing when it fails.
  inSandbox: (container: string, command: string[]) => Promise<string>;
  // A file the agent can read, so that it learns why its command ended.
  logFile: string;
  report: (report: Report) => void;
}

const short = (command: string) => (command.length > 160 ? `${command.slice(0, 160)}...` : command);

// End the command that holds the most memory once a sandbox has stalled on memory in two readings
// in a row.
//
// The kernel ends a process of a sandbox at its memory limit only when it can free nothing at all.
// While it can still take the code of the processes out of memory and read it back from the disk,
// it does that, and a build that needs more than the sandbox has neither fails nor moves on.
// Ending the command gives the agent the exit status it would have got from the kernel.
export const memoryGuard = (guard: Guard) => {
  let stalledReadings = 0;
  let reported = false;
  return async (sample: HostSample, container: string | undefined): Promise<void> => {
    const sandbox = sample.container;
    const waiting = sandbox?.stalledNowPercent ?? 0;
    stalledReadings = container && waiting >= STALLED_PERCENT ? stalledReadings + 1 : 0;
    if (!container || !sandbox || stalledReadings < 2) {
      return;
    }
    stalledReadings = 0;
    const command = heaviestCommand(
      parseProcesses(await guard.inSandbox(container, ['ps', '-eo', 'pid=,ppid=,rss=,args='])),
      guard.agent
    );
    // Ending a command that holds less than a tenth of the memory would not end the stall.
    if (!command || command.rssMb * 10 < sandbox.memLimitMb) {
      return;
    }
    const line = `Minute ${sample.minute}: the sandbox had no memory left, and its processes waited for memory in ${Math.round(waiting)}% of the last ten seconds. The runner ends the command that holds the most, ${command.rssMb} MB in ${command.pids.length} process(es): ${short(command.started.command)}${command.largest === command.started ? '' : `. Its largest process, with ${command.largest.rssMb} MB: ${short(command.largest.command)}`}`;
    // Written first: the agent looks for it the moment its command returns.
    appendFileSync(guard.logFile, `${line}\n`);
    await guard.inSandbox(container, ['kill', '-KILL', ...command.pids.map(String)]);
    // A job step keeps ten warnings, and a run that stalls again and again must not use them up.
    if (reported) {
      console.log(line);
    } else {
      reported = true;
      guard.report({ level: 'warning', line });
    }
  };
};
