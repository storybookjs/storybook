import { type ChildProcess, spawn } from 'node:child_process';
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
  settledSamples = samples.filter((sample) => sample.phase === phase)
): MemoryPhaseResult {
  const phaseSamples = samples.filter((sample) => sample.phase === phase);
  const rss = phaseSamples.map((sample) => sample.processTreeRssBytes / MB);
  const settledRss = settledSamples.map((sample) => sample.processTreeRssBytes / MB);
  const peakProcessTreeRssMb = Math.max(...rss, 0);
  const settledProcessTreeRssMb = settledRss.at(-1) ?? 0;
  const result: MemoryPhaseResult = {
    peakProcessTreeRssMb,
    settledProcessTreeRssMb,
    sampleCount: rss.length,
  };
  if (phase === 'devHmr' && settledRss.length > 1) {
    result.growthMb = settledProcessTreeRssMb - settledRss[0];
    result.slopeMbPerEdit = result.growthMb / (settledRss.length - 1);
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

  setRoot(pid: number | undefined) {
    this.rootPid = pid;
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

  async capture() {
    while (this.sampling) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    await this.sample();
    const sample = this.samples.at(-1);
    if (!sample) {
      throw new Error('The process-tree sampler did not capture a sample.');
    }
    return sample;
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
    await page.waitForFunction(() => {
      const preview = document.querySelector<HTMLIFrameElement>('iframe#storybook-preview-iframe');
      return preview?.contentDocument?.readyState === 'complete';
    });
    const previewFrame = page.frame({ url: /iframe\.html(?:\?|$)/ });
    if (!previewFrame) {
      throw new Error('The Storybook preview iframe was not available.');
    }
    await previewFrame.getByText('Button', { exact: true }).waitFor({ state: 'visible' });
    return { browser, previewFrame };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

function startDev(command: string, cwd: string, sampler: ProcessTreeSampler) {
  const child = spawn(command, { cwd, shell: true, detached: process.platform !== 'win32' });
  const exit = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  sampler.setRoot(child.pid!);
  return {
    exit,
    async stop() {
      terminate(child);
      if (await waitForExit(exit, 10_000)) {
        return;
      }
      terminate(child, 'SIGKILL');
      await exit;
    },
  };
}

async function waitForExit(exit: Promise<number | null>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      exit.then(() => true),
      new Promise<false>((resolve) => {
        timeout = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function terminate(child: ChildProcess, signal: NodeJS.Signals = 'SIGTERM') {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  try {
    if (process.platform !== 'win32' && child.pid) {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
      throw error;
    }
  }
}

function updateStoryLabel(source: string, label: string) {
  const updated = source.replace(/label:\s*'Button'/, `label: '${label}'`);
  if (updated === source) {
    throw new Error('The HMR fixture no longer contains the expected Button story label.');
  }
  return updated;
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
  const dev = startDev(`yarn storybook --ci --port ${port}`, cwd, sampler);
  const hmrSettledSamples: MemorySample[] = [];
  try {
    await Promise.race([
      waitFor(`http://127.0.0.1:${port}/iframe.html`, 200_000),
      dev.exit.then((exitCode) => {
        throw new Error(`storybook dev exited before it became ready (${exitCode})`);
      }),
    ]);
    const { browser, previewFrame } = await waitForFirstStory(`http://127.0.0.1:${port}`);
    try {
      sampler.setPhase('devHmr');
      const original = await readFile(hmrFile, 'utf8');
      try {
        hmrSettledSamples.push(await sampler.capture());
        for (let edit = 1; edit <= hmrEdits; edit++) {
          const label = `Memory benchmark edit ${edit}`;
          await writeFile(hmrFile, updateStoryLabel(original, label));
          await previewFrame.getByText(label, { exact: true }).waitFor({ state: 'visible' });
          hmrSettledSamples.push(await sampler.capture());
        }
      } finally {
        await writeFile(hmrFile, original);
      }
    } finally {
      await browser.close();
    }
  } finally {
    await dev.stop();
  }

  sampler.setRoot(undefined);
  const build = spawn('yarn build-storybook --quiet', { cwd, shell: true, detached: true });
  sampler.setRoot(build.pid!);
  sampler.setPhase('build');
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
      devHmr: summarizePhase(samples, 'devHmr', hmrSettledSamples),
      build: summarizePhase(samples, 'build'),
    },
    samples,
  };
}
