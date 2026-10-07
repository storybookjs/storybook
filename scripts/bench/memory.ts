import { spawn } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { join } from 'node:path';

import { chromium } from 'playwright';

const MB = 1024 * 1024;

export type MemoryPhase = 'devStartup' | 'devHmr' | 'build';

export interface ProcessMemory {
  pid: number;
  parentPid: number;
  rssBytes: number;
}

export interface MemorySample {
  elapsedMs: number;
  phase: MemoryPhase;
  processTreeRssBytes: number;
  processes: ProcessMemory[];
}

export interface MemoryPhaseResult {
  peakProcessTreeRssMb: number;
  settledProcessTreeRssMb: number;
  growthMb?: number;
  slopeMbPerEdit?: number;
  sampleCount: number;
}

export interface MemoryBenchmarkResult {
  schemaVersion: 1;
  environment: {
    node: string;
    platform: NodeJS.Platform;
    architecture: string;
    cpu: string;
    commit?: string;
    samplingIntervalMs: number;
    processScope: 'server-and-descendants';
    browserMemory: 'excluded';
    gc: 'natural';
  };
  scenario: string;
  phases: Record<MemoryPhase, MemoryPhaseResult>;
  samples: MemorySample[];
}

interface ProcStatus {
  pid: number;
  parentPid: number;
  rssBytes: number;
}

function parseStatus(pid: number, status: string): ProcStatus | undefined {
  const parentPid = /^PPid:\s+(\d+)$/m.exec(status)?.[1];
  const rssKb = /^VmRSS:\s+(\d+)\s+kB$/m.exec(status)?.[1];
  if (!parentPid || !rssKb) {
    return undefined;
  }
  return { pid, parentPid: Number(parentPid), rssBytes: Number(rssKb) * 1024 };
}

export async function listLinuxProcesses(procRoot = '/proc'): Promise<ProcStatus[]> {
  const entries = await readdir(procRoot, { withFileTypes: true });
  const pids = entries
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => Number(entry.name));
  const processes = await Promise.all(
    pids.map(async (pid) => {
      try {
        return parseStatus(pid, await readFile(join(procRoot, String(pid), 'status'), 'utf8'));
      } catch {
        return undefined;
      }
    })
  );
  return processes.filter((process): process is ProcStatus => process !== undefined);
}

export function processTree(processes: ProcStatus[], rootPid: number): ProcStatus[] {
  const children = new Map<number, ProcStatus[]>();
  for (const process of processes) {
    children.set(process.parentPid, [...(children.get(process.parentPid) ?? []), process]);
  }
  const byPid = new Map(processes.map((process) => [process.pid, process]));
  const tree: ProcStatus[] = [];
  const pending = [rootPid];
  while (pending.length > 0) {
    const pid = pending.pop();
    if (pid === undefined) {
      continue;
    }
    const process = byPid.get(pid);
    if (process) {
      tree.push(process);
    }
    pending.push(...(children.get(pid) ?? []).map((child) => child.pid));
  }
  return tree;
}

export function summarizePhase(
  samples: MemorySample[],
  phase: MemoryPhase,
  updates = samples.filter((sample) => sample.phase === phase).length - 1
): MemoryPhaseResult {
  const phaseSamples = samples.filter((sample) => sample.phase === phase);
  const rss = phaseSamples.map((sample) => sample.processTreeRssBytes / MB);
  const peakProcessTreeRssMb = Math.max(...rss, 0);
  const settledProcessTreeRssMb = rss.at(-1) ?? 0;
  const result: MemoryPhaseResult = {
    peakProcessTreeRssMb,
    settledProcessTreeRssMb,
    sampleCount: rss.length,
  };
  if (phase === 'devHmr' && rss.length > 1 && updates > 0) {
    result.growthMb = settledProcessTreeRssMb - rss[0];
    result.slopeMbPerEdit = result.growthMb / updates;
  }
  return result;
}

class ProcessTreeSampler {
  private readonly samples: MemorySample[] = [];
  private rootPid: number | undefined;
  private phase: MemoryPhase = 'devStartup';
  private timer: ReturnType<typeof setInterval> | undefined;
  private startedAt = Date.now();
  private sampling = false;

  constructor(private readonly intervalMs: number) {}

  setRoot(pid: number) {
    this.rootPid = pid;
    void this.sample();
  }

  setPhase(phase: MemoryPhase) {
    this.phase = phase;
  }

  start() {
    this.timer = setInterval(() => void this.sample(), this.intervalMs);
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    while (this.sampling) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    return this.samples;
  }

  private async sample() {
    if (!this.rootPid || this.sampling || process.platform !== 'linux') {
      return;
    }
    const rootPid = this.rootPid;
    const phase = this.phase;
    const elapsedMs = Date.now() - this.startedAt;
    this.sampling = true;
    try {
      const processes = processTree(await listLinuxProcesses(), rootPid);
      this.samples.push({
        elapsedMs,
        phase,
        processTreeRssBytes: processes.reduce((total, current) => total + current.rssBytes, 0),
        processes,
      });
    } finally {
      this.sampling = false;
    }
  }
}

async function waitFor(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await fetch(url)
      .then((response) => response.ok)
      .catch(() => false);
    if (ready) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForFirstStory(url: string) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${url}?path=/story/example-button--primary`);
    await page.waitForSelector('#example-button--primary', { state: 'attached', timeout: 40_000 });
    return { browser, page };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function startDev(command: string, cwd: string, sampler: ProcessTreeSampler) {
  const child = spawn(command, { cwd, shell: true, detached: process.platform !== 'win32' });
  sampler.setRoot(child.pid!);
  child.once('error', (error) => console.error(error));
  return () => {
    try {
      if (process.platform !== 'win32' && child.pid) {
        process.kill(-child.pid, 'SIGTERM');
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      return;
    }
  };
}

export async function runMemoryBenchmark({
  cwd,
  scenario,
  port = 6006,
  hmrFile,
  hmrEdits = 10,
  samplingIntervalMs = 100,
}: {
  cwd: string;
  scenario: string;
  port?: number;
  hmrFile: string;
  hmrEdits?: number;
  samplingIntervalMs?: number;
}): Promise<MemoryBenchmarkResult> {
  if (process.platform !== 'linux') {
    throw new Error('The memory benchmark currently requires Linux because it samples /proc.');
  }
  const sampler = new ProcessTreeSampler(samplingIntervalMs);
  sampler.start();
  const devStop = await startDev(`yarn storybook --ci --port ${port}`, cwd, sampler);
  try {
    await waitFor(`http://127.0.0.1:${port}/iframe.html`, 200_000);
    const { browser, page } = await waitForFirstStory(`http://127.0.0.1:${port}`);
    sampler.setPhase('devHmr');
    const original = await readFile(hmrFile, 'utf8');
    try {
      for (let edit = 1; edit <= hmrEdits; edit++) {
        await writeFile(hmrFile, `${original}\n// memory-benchmark-edit-${edit}\n`);
        await waitFor(`http://127.0.0.1:${port}/iframe.html`, 30_000);
        await page.waitForSelector('#example-button--primary', { state: 'attached', timeout: 30_000 });
        await new Promise((resolve) => setTimeout(resolve, samplingIntervalMs * 2));
      }
    } finally {
      await writeFile(hmrFile, original);
      await browser.close();
    }
  } finally {
    devStop();
  }

  sampler.setPhase('build');
  const build = spawn('yarn build-storybook --quiet', { cwd, shell: true, detached: true });
  sampler.setRoot(build.pid!);
  let exitCode: number | null = null;
  let samples: MemorySample[] = [];
  try {
    exitCode = await new Promise<number | null>((resolve, reject) => {
      build.once('error', reject);
      build.once('exit', resolve);
    });
  } finally {
    samples = await sampler.stop();
  }
  if (exitCode !== 0) {
    throw new Error(`storybook build exited with ${exitCode}`);
  }
  return {
    schemaVersion: 1,
    environment: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      cpu: cpus()[0]?.model ?? 'unknown',
      commit: process.env.CIRCLE_SHA1,
      samplingIntervalMs,
      processScope: 'server-and-descendants',
      browserMemory: 'excluded',
      gc: 'natural',
    },
    scenario,
    phases: {
      devStartup: summarizePhase(samples, 'devStartup'),
      devHmr: summarizePhase(samples, 'devHmr', hmrEdits),
      build: summarizePhase(samples, 'build'),
    },
    samples,
  };
}
