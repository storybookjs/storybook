import { execFile } from 'node:child_process';
import { appendFileSync, readFileSync, statfsSync } from 'node:fs';
import { cpus, freemem, loadavg, platform, totalmem } from 'node:os';

// What the machine that runs the agent looked like at one moment of a run.
export interface HostSample {
  minute: number;
  // How much later than planned this reading was taken. A machine that keeps up is not late.
  lateSeconds?: number;
  memTotalMb: number;
  memAvailableMb: number;
  swapTotalMb: number;
  swapFreeMb: number;
  // Windows has no such figure.
  load1?: number;
  cpus: number;
  diskFreeMb: number;
  // Percent of the last minute in which all work on a Linux host waited, for memory and for the disk.
  stalled?: { memory: number; disk: number };
  container?: {
    memUsedMb: number;
    memLimitMb: number;
    cpuPercent: number;
    pids: number;
    // Percent of the last minute, and of the last ten seconds, in which every process of the
    // sandbox waited for memory.
    stalledPercent?: number;
    stalledNowPercent?: number;
  };
}

type Memory = Pick<HostSample, 'memTotalMb' | 'memAvailableMb' | 'swapTotalMb' | 'swapFreeMb'>;

const MB = 2 ** 20;

// A sandbox at its memory limit is not always ended by the kernel. As long as taking the code of
// its processes out of memory frees a page, the kernel does that and reads the code back from the
// disk, and no process gets anything done. A sandbox whose processes wait for memory this share of
// the time is in that state: the stalls seen so far sat between 20 and 85, a sandbox with room at 0.
export const STALLED_PERCENT = 20;

const LATE_SECONDS = 60;

// The kernel's own account, in kB. MemAvailable counts the cache it can give back, which MemFree
// leaves out.
export const parseMeminfo = (text: string): Memory | undefined => {
  const kb = (name: string) => Number(new RegExp(`^${name}:\\s+(\\d+) kB$`, 'm').exec(text)?.[1]);
  const memory = {
    memTotalMb: Math.round(kb('MemTotal') / 1024),
    memAvailableMb: Math.round(kb('MemAvailable') / 1024),
    swapTotalMb: Math.round(kb('SwapTotal') / 1024),
    swapFreeMb: Math.round(kb('SwapFree') / 1024),
  };
  return Object.values(memory).every(Number.isFinite) ? memory : undefined;
};

// The `full` line of a kernel pressure file: the share of the last ten seconds and of the last
// minute in which every task that had work to do waited for the resource.
export const parseStalled = (text: string): { now: number; minute: number } | undefined => {
  const [, now, minute] = /^full avg10=([\d.]+) avg60=([\d.]+)/m.exec(text) ?? [];
  return now === undefined ? undefined : { now: Number(now), minute: Number(minute) };
};

const UNIT: Record<string, number> = {
  B: 1 / MB,
  kB: 1 / 1000,
  KiB: 1 / 1024,
  MB: 1,
  MiB: 1,
  GB: 1000,
  GiB: 1024,
};

const megabytes = (text: string): number => {
  const [, value, unit] = /^([\d.]+)\s*([A-Za-z]+)$/.exec(text.trim()) ?? [];
  return Math.round(Number(value) * (UNIT[unit ?? ''] ?? Number.NaN));
};

// One line of `docker stats --no-stream --format '{{.MemUsage}}|{{.CPUPerc}}|{{.PIDs}}'`.
export const parseDockerStats = (line: string): HostSample['container'] => {
  const [memory = '', cpu = '', pids = ''] = line.trim().split('|');
  const [used = '', limit = ''] = memory.split(' / ');
  const container = {
    memUsedMb: megabytes(used),
    memLimitMb: megabytes(limit),
    cpuPercent: Number.parseFloat(cpu),
    pids: Number(pids),
  };
  return Object.values(container).every(Number.isFinite) ? container : undefined;
};

// The conditions under which a machine stops answering, each with the sentence to report.
export const pressureOf = (sample: HostSample): Record<string, string> => {
  const pressure: Record<string, string> = {};
  if (sample.memTotalMb > 0 && sample.memAvailableMb < sample.memTotalMb * 0.06) {
    pressure.memory = `only ${sample.memAvailableMb} of ${sample.memTotalMb} MB of host memory are available`;
  }
  if (sample.swapTotalMb > 0 && sample.swapFreeMb < sample.swapTotalMb * 0.5) {
    pressure.swap = `${sample.swapTotalMb - sample.swapFreeMb} of ${sample.swapTotalMb} MB of host swap are in use`;
  }
  if (sample.diskFreeMb < 4096) {
    pressure.disk = `only ${sample.diskFreeMb} MB of disk are free`;
  }
  if (sample.load1 !== undefined && sample.load1 > sample.cpus * 4) {
    pressure.load = `the load is ${sample.load1.toFixed(1)} on ${sample.cpus} CPUs`;
  }
  if (sample.container && sample.container.memUsedMb > sample.container.memLimitMb * 0.95) {
    pressure.container = `the sandbox uses ${sample.container.memUsedMb} of its ${sample.container.memLimitMb} MB`;
  }
  if ((sample.container?.stalledPercent ?? 0) >= STALLED_PERCENT) {
    pressure.stalled = `the processes of the sandbox waited for memory in ${Math.round(sample.container?.stalledPercent ?? 0)}% of the last minute`;
  }
  if ((sample.lateSeconds ?? 0) > LATE_SECONDS) {
    pressure.late = `this reading came ${sample.lateSeconds} seconds late, so the host stood still or cannot keep up`;
  }
  return pressure;
};

export const sampleLine = (sample: HostSample): string =>
  [
    `minute ${sample.minute}`,
    sample.memTotalMb > 0
      ? `host memory ${sample.memAvailableMb} of ${sample.memTotalMb} MB available`
      : 'host memory unknown',
    ...(sample.swapTotalMb > 0
      ? [`swap ${sample.swapTotalMb - sample.swapFreeMb} of ${sample.swapTotalMb} MB used`]
      : []),
    ...(sample.load1 === undefined
      ? []
      : [`load ${sample.load1.toFixed(1)} on ${sample.cpus} CPUs`]),
    ...(sample.stalled
      ? [
          `host waiting for memory ${Math.round(sample.stalled.memory)}% and for the disk ${Math.round(sample.stalled.disk)}% of the last minute`,
        ]
      : []),
    `disk ${sample.diskFreeMb} MB free`,
    ...(sample.container
      ? [
          `sandbox ${sample.container.memUsedMb} of ${sample.container.memLimitMb} MB, ${sample.container.pids} processes${sample.container.stalledPercent === undefined ? '' : `, waiting for memory ${Math.round(sample.container.stalledPercent)}% of the last minute`}`,
        ]
      : []),
  ].join(', ');

export interface Report {
  level: 'notice' | 'warning';
  line: string;
}

const NOTICE_EVERY_MINUTES = 20;

// Decide what a reading adds to what a run has already reported: a warning the first time a
// condition holds, and a plain reading every twenty minutes.
//
// A job step keeps ten annotations of a level and drops the rest, so a condition that holds for an
// hour must not use them up.
export const reporter = (): ((sample: HostSample) => Report[]) => {
  const reported = new Set<string>();
  let lastNotice = 0;
  return (sample) => {
    const reports: Report[] = [];
    for (const [key, sentence] of Object.entries(pressureOf(sample))) {
      if (!reported.has(key)) {
        reported.add(key);
        reports.push({
          level: 'warning',
          line: `The machine is running short: ${sentence}. ${sampleLine(sample)}.`,
        });
      }
    }
    if (sample.minute >= lastNotice + NOTICE_EVERY_MINUTES) {
      lastNotice = sample.minute - (sample.minute % NOTICE_EVERY_MINUTES);
      reports.push({ level: 'notice', line: `The machine at ${sampleLine(sample)}.` });
    }
    return reports;
  };
};

// What a program prints, or nothing when it fails or takes more than twenty seconds.
export const outputOf = (command: string, args: string[]): Promise<string> =>
  new Promise((done) => {
    execFile(command, args, { encoding: 'utf8', timeout: 20_000 }, (error, stdout) =>
      done(error ? '' : stdout)
    );
  });

const read = (file: string): string => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
};

// On Linux the sandbox shares the kernel, so the host's own tables are right. On macOS the sandbox
// runs in the Docker machine, and only its tables say what that machine has left. What macOS itself
// calls free leaves out all it could give back, so without a sandbox nothing is known there.
const memoryOf = (insideSandbox: string): Memory => {
  if (platform() === 'win32') {
    return {
      memTotalMb: Math.round(totalmem() / MB),
      memAvailableMb: Math.round(freemem() / MB),
      swapTotalMb: 0,
      swapFreeMb: 0,
    };
  }
  return (
    parseMeminfo(read('/proc/meminfo') || insideSandbox) ?? {
      memTotalMb: 0,
      memAvailableMb: 0,
      swapTotalMb: 0,
      swapFreeMb: 0,
    }
  );
};

const stalledHost = (): HostSample['stalled'] => {
  const memory = parseStalled(read('/proc/pressure/memory'));
  const disk = parseStalled(read('/proc/pressure/io'));
  return memory && disk ? { memory: memory.minute, disk: disk.minute } : undefined;
};

interface Watch {
  // Where the samples go, one JSON line each.
  file: string;
  startedAt: Date;
  // A directory on the disk that fills up.
  diskDir: string;
  // The name of the sandbox container, once there is one.
  container: () => string | undefined;
  // Called for the lines that must outlive a lost machine.
  report: (report: Report) => void;
  // Called with every reading, and awaited before the next one is taken.
  onSample?: (sample: HostSample, container: string | undefined) => Promise<void>;
  intervalMs?: number;
}

// Record what the machine looks like while the agent works, and say so when it runs short.
//
// A runner that stops answering takes the job log and every file with it. Only annotations outlive
// it, so they are the one trace of why it stopped.
export const watchHost = (watch: Watch): { stop: () => void } => {
  const intervalMs = watch.intervalMs ?? 30_000;
  const reportsOf = reporter();
  let busy = false;
  let last: number | undefined;

  const sample = async () => {
    if (busy) {
      return;
    }
    busy = true;
    try {
      const startedAt = Date.now();
      const lateSeconds =
        last === undefined
          ? undefined
          : Math.max(0, Math.round((startedAt - last - intervalMs) / 1000));
      last = startedAt;
      const name = watch.container();
      const [stats, inside] = name
        ? await Promise.all([
            outputOf('docker', [
              'stats',
              '--no-stream',
              '--format',
              '{{.MemUsage}}|{{.CPUPerc}}|{{.PIDs}}',
              name,
            ]),
            outputOf('docker', [
              'exec',
              name,
              'sh',
              '-c',
              'cat /sys/fs/cgroup/memory.pressure 2>/dev/null; cat /proc/meminfo',
            ]),
          ])
        : ['', ''];
      const container = parseDockerStats(stats);
      const waiting = parseStalled(inside);
      const stalled = stalledHost();
      const disk = statfsSync(watch.diskDir);
      const current: HostSample = {
        minute: Math.floor((startedAt - watch.startedAt.getTime()) / 60_000),
        ...(lateSeconds === undefined ? {} : { lateSeconds }),
        ...memoryOf(inside),
        ...(platform() === 'win32' ? {} : { load1: loadavg()[0] ?? 0 }),
        cpus: cpus().length,
        diskFreeMb: Math.round((disk.bavail * disk.bsize) / MB),
        ...(stalled ? { stalled } : {}),
        ...(container
          ? {
              container: {
                ...container,
                ...(waiting
                  ? { stalledPercent: waiting.minute, stalledNowPercent: waiting.now }
                  : {}),
              },
            }
          : {}),
      };
      appendFileSync(
        watch.file,
        `${JSON.stringify({ at: new Date(startedAt).toISOString(), ...current })}\n`
      );
      reportsOf(current).forEach(watch.report);
      await watch.onSample?.(current, name);
    } catch {
      // A reading that fails must never end the run it watches.
    } finally {
      busy = false;
    }
  };

  const timer = setInterval(() => void sample(), intervalMs);
  timer.unref();
  void sample();
  return { stop: () => clearInterval(timer) };
};
