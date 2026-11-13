import { describe, expect, it } from 'vitest';

import {
  parseDockerStats,
  parseMeminfo,
  pressureOf,
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
});
