import { execFile } from 'node:child_process';
import { appendFileSync, readFileSync, statfsSync } from 'node:fs';
import { cpus, loadavg } from 'node:os';

// What the machine that runs the agent looked like at one moment of a run.
export interface HostSample {
  minute: number;
  memTotalMb: number;
  memAvailableMb: number;
  swapTotalMb: number;
  swapFreeMb: number;
  load1: number;
  cpus: number;
  diskFreeMb: number;
  container?: { memUsedMb: number; memLimitMb: number; cpuPercent: number; pids: number };
}

type Memory = Pick<HostSample, 'memTotalMb' | 'memAvailableMb' | 'swapTotalMb' | 'swapFreeMb'>;

const MB = 2 ** 20;

// The kernel's own account, in kB. MemAvailable counts the cache it can give back, which MemFree and
// os.freemem() leave out.
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

// The conditions under which a machine stops answering, each with the sentence to report. A key is
// reported once in a run, so the list stays far below the ten annotations a job step may leave.
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
  if (sample.load1 > sample.cpus * 4) {
    pressure.load = `the load is ${sample.load1.toFixed(1)} on ${sample.cpus} CPUs`;
  }
  if (sample.container && sample.container.memUsedMb > sample.container.memLimitMb * 0.95) {
    pressure.container = `the sandbox uses ${sample.container.memUsedMb} of its ${sample.container.memLimitMb} MB`;
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
    `load ${sample.load1.toFixed(1)} on ${sample.cpus} CPUs`,
    `disk ${sample.diskFreeMb} MB free`,
    ...(sample.container
      ? [
          `sandbox ${sample.container.memUsedMb} of ${sample.container.memLimitMb} MB, ${sample.container.pids} processes`,
        ]
      : []),
  ].join(', ');

const run = (command: string, args: string[]): Promise<string> =>
  new Promise((done) => {
    execFile(command, args, { encoding: 'utf8', timeout: 20_000 }, (error, stdout) =>
      done(error ? '' : stdout)
    );
  });

interface Watch {
  // Where the samples go, one JSON line each.
  file: string;
  startedAt: Date;
  // A directory on the disk that fills up.
  diskDir: string;
  // The name of the sandbox container, once there is one.
  container: () => string | undefined;
  // Called for the lines that must outlive a lost machine.
  report: (level: 'notice' | 'warning', line: string) => void;
  intervalMs?: number;
}

const NOTICE_EVERY_MINUTES = 20;

// Record what the machine looks like while the agent works, and say so when it runs short.
//
// A runner that stops answering takes the job log and every file with it. Only annotations outlive
// it, so this is the one trace of why it stopped: a warning when a condition first holds, and a
// plain reading every twenty minutes.
export const watchHost = (watch: Watch): { stop: () => void } => {
  const reported = new Set<string>();
  let lastNotice = 0;
  let busy = false;

  const memory = async (name: string | undefined): Promise<Memory> => {
    let text = '';
    try {
      text = readFileSync('/proc/meminfo', 'utf8');
    } catch {
      // Not Linux: with a container, its /proc/meminfo is that of the Docker machine.
      text = name ? await run('docker', ['exec', name, 'cat', '/proc/meminfo']) : '';
    }
    // Outside Linux and without a container nothing says what is available: what macOS calls free
    // leaves out all it could give back.
    return (
      parseMeminfo(text) ?? { memTotalMb: 0, memAvailableMb: 0, swapTotalMb: 0, swapFreeMb: 0 }
    );
  };

  const sample = async () => {
    if (busy) {
      return;
    }
    busy = true;
    try {
      const name = watch.container();
      const stats = name
        ? await run('docker', [
            'stats',
            '--no-stream',
            '--format',
            '{{.MemUsage}}|{{.CPUPerc}}|{{.PIDs}}',
            name,
          ])
        : '';
      const disk = statfsSync(watch.diskDir);
      const current: HostSample = {
        minute: Math.floor((Date.now() - watch.startedAt.getTime()) / 60_000),
        ...(await memory(name)),
        load1: loadavg()[0] ?? 0,
        cpus: cpus().length,
        diskFreeMb: Math.round((disk.bavail * disk.bsize) / MB),
        ...(parseDockerStats(stats) ? { container: parseDockerStats(stats) } : {}),
      };
      appendFileSync(
        watch.file,
        `${JSON.stringify({ at: new Date().toISOString(), ...current })}\n`
      );
      for (const [key, sentence] of Object.entries(pressureOf(current))) {
        if (!reported.has(key)) {
          reported.add(key);
          watch.report(
            'warning',
            `The machine is running short: ${sentence}. ${sampleLine(current)}.`
          );
        }
      }
      if (current.minute >= lastNotice + NOTICE_EVERY_MINUTES) {
        lastNotice = current.minute - (current.minute % NOTICE_EVERY_MINUTES);
        watch.report('notice', `The machine at ${sampleLine(current)}.`);
      }
    } catch {
      // A reading that fails must never end the run it watches.
    } finally {
      busy = false;
    }
  };

  const timer = setInterval(() => void sample(), watch.intervalMs ?? 30_000);
  timer.unref();
  void sample();
  return { stop: () => clearInterval(timer) };
};
