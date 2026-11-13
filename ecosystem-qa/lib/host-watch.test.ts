import { describe, expect, it } from 'vitest';

import {
  parseDockerStats,
  parseMeminfo,
  parseStalled,
  pressureOf,
  reporter,
  sampleLine,
  type HostSample,
} from './host-watch.ts';

const MEMINFO = [
  'MemTotal:       16373292 kB',
  'MemFree:          213772 kB',
  'MemAvailable:    1048576 kB',
  'Buffers:           83244 kB',
  'SwapTotal:       4194300 kB',
  'SwapFree:        1048576 kB',
].join('\n');

const healthy: HostSample = {
  minute: 40,
  memTotalMb: 15990,
  memAvailableMb: 9000,
  swapTotalMb: 4096,
  swapFreeMb: 4096,
  load1: 3.2,
  cpus: 4,
  diskFreeMb: 80_000,
  container: { memUsedMb: 5000, memLimitMb: 13585, cpuPercent: 180, pids: 60 },
};

describe('parseMeminfo', () => {
  it('reads what is available, not what is free, and the swap', () => {
    expect(parseMeminfo(MEMINFO)).toEqual({
      memTotalMb: 15990,
      memAvailableMb: 1024,
      swapTotalMb: 4096,
      swapFreeMb: 1024,
    });
  });

  it('knows nothing from a text that is not the kernel table', () => {
    expect(parseMeminfo('')).toBeUndefined();
    expect(parseMeminfo('MemTotal: 16373292 kB')).toBeUndefined();
  });
});

describe('parseStalled', () => {
  it('reads the share of the last ten seconds and of the last minute in which everything waited', () => {
    const pressure = [
      'some avg10=86.94 avg60=54.73 avg300=19.88 total=71794989',
      'full avg10=85.15 avg60=53.97 avg300=19.68 total=71179153',
    ].join('\n');

    expect(parseStalled(pressure)).toEqual({ now: 85.15, minute: 53.97 });
  });

  it('knows nothing where the kernel keeps no such account', () => {
    expect(parseStalled('')).toBeUndefined();
    expect(parseStalled('some avg10=1.00 avg60=2.00 avg300=3.00 total=4')).toBeUndefined();
  });
});

describe('parseDockerStats', () => {
  it('reads memory in the units docker prints, the CPU share and the process count', () => {
    expect(parseDockerStats('1.5GiB / 13.27GiB|187.42%|211\n')).toEqual({
      memUsedMb: 1536,
      memLimitMb: 13588,
      cpuPercent: 187.42,
      pids: 211,
    });
    expect(parseDockerStats('824.3MiB / 7.746GiB|0.00%|12')?.memUsedMb).toBe(824);
  });

  it('knows nothing from the empty output of a container that is gone', () => {
    expect(parseDockerStats('')).toBeUndefined();
  });
});

describe('pressureOf', () => {
  it('reports nothing for a machine with room', () => {
    expect(pressureOf(healthy)).toEqual({});
  });

  it('names host memory when less than six percent of it is available', () => {
    expect(pressureOf({ ...healthy, memAvailableMb: 900 })).toEqual({
      memory: 'only 900 of 15990 MB of host memory are available',
    });
    expect(pressureOf({ ...healthy, memAvailableMb: 1000 })).toEqual({});
  });

  it('names swap once half of it is in use, and not on a machine without swap', () => {
    expect(pressureOf({ ...healthy, swapFreeMb: 1000 })).toEqual({
      swap: '3096 of 4096 MB of host swap are in use',
    });
    expect(pressureOf({ ...healthy, swapTotalMb: 0, swapFreeMb: 0 })).toEqual({});
  });

  it('names the disk, the load and a sandbox at its memory limit', () => {
    expect(
      Object.keys(
        pressureOf({
          ...healthy,
          diskFreeMb: 2000,
          load1: 40,
          container: { memUsedMb: 13_400, memLimitMb: 13_585, cpuPercent: 390, pids: 300 },
        })
      )
    ).toEqual(['disk', 'load', 'container']);
  });

  it('names a sandbox whose processes wait for memory a fifth of the time', () => {
    const waiting = (stalledPercent: number) =>
      pressureOf({ ...healthy, container: { ...healthy.container!, stalledPercent } });

    expect(waiting(53.97)).toEqual({
      stalled: 'the processes of the sandbox waited for memory in 54% of the last minute',
    });
    expect(waiting(19.9)).toEqual({});
  });

  it('names a reading that came more than a minute late', () => {
    expect(pressureOf({ ...healthy, lateSeconds: 95 })).toEqual({
      late: 'this reading came 95 seconds late, so the host stood still or cannot keep up',
    });
    expect(pressureOf({ ...healthy, lateSeconds: 60 })).toEqual({});
  });

  it('does not judge a load that Windows does not have', () => {
    const { load1: _load1, ...windows } = healthy;

    expect(pressureOf(windows)).toEqual({});
    expect(sampleLine(windows)).not.toContain('load');
  });

  it('does not judge memory it could not read', () => {
    const unknown = { ...healthy, memTotalMb: 0, memAvailableMb: 0, swapTotalMb: 0, swapFreeMb: 0 };

    expect(pressureOf(unknown)).toEqual({});
    expect(sampleLine(unknown)).toContain('host memory unknown');
  });

  it('judges a run without a sandbox container by the host alone', () => {
    const { container: _container, ...host } = healthy;

    expect(pressureOf(host)).toEqual({});
  });
});

describe('sampleLine', () => {
  it('puts one reading on one line', () => {
    expect(sampleLine(healthy)).toBe(
      'minute 40, host memory 9000 of 15990 MB available, swap 0 of 4096 MB used, load 3.2 on 4 CPUs, disk 80000 MB free, sandbox 5000 of 13585 MB, 60 processes'
    );
  });

  it('adds how long the host and the sandbox waited, where the kernel says so', () => {
    expect(
      sampleLine({
        ...healthy,
        stalled: { memory: 41.2, disk: 7.6 },
        container: { ...healthy.container!, stalledPercent: 53.97 },
      })
    ).toBe(
      'minute 40, host memory 9000 of 15990 MB available, swap 0 of 4096 MB used, load 3.2 on 4 CPUs, host waiting for memory 41% and for the disk 8% of the last minute, disk 80000 MB free, sandbox 5000 of 13585 MB, 60 processes, waiting for memory 54% of the last minute'
    );
  });
});

describe('reporter', () => {
  const levels = (reports: { level: string }[]) => reports.map(({ level }) => level);

  it('warns once about a condition that holds for a whole run', () => {
    const reportsOf = reporter();
    const short = { ...healthy, minute: 5, diskFreeMb: 2000 };

    expect(reportsOf(short)).toEqual([
      {
        level: 'warning',
        line: `The machine is running short: only 2000 MB of disk are free. ${sampleLine(short)}.`,
      },
    ]);
    expect(reportsOf({ ...short, minute: 6 })).toEqual([]);
    expect(reportsOf({ ...short, minute: 7, load1: 40 }).map(({ line }) => line)).toEqual([
      expect.stringContaining('the load is 40.0 on 4 CPUs'),
    ]);
  });

  it('gives a plain reading every twenty minutes, also after a reading that came late', () => {
    const reportsOf = reporter();
    const at = (minute: number) => levels(reportsOf({ ...healthy, minute }));

    expect(at(0)).toEqual([]);
    expect(at(19)).toEqual([]);
    expect(at(20)).toEqual(['log']);
    expect(at(21)).toEqual([]);
    expect(at(47)).toEqual(['log']);
    expect(at(59)).toEqual([]);
    expect(at(60)).toEqual(['log']);
  });
});
