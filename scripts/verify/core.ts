// Shared types, run-path math, verdict computation, and run pruning for the PR verify harness.

import * as path from 'node:path';
import * as fs from 'node:fs/promises';

export interface CaptureMetadata {
  pageErrors: string[];
  consoleErrors: string[];
  errorDisplayHidden: boolean;
  previewHasChildren: boolean;
  screenshotPath: string;
}

export interface Durations {
  compileMs?: number;
  symlinkMs?: number;
  bootMs?: number;
  captureMs?: number;
  totalMs: number;
}

export interface VerifyResult {
  runId: string;
  verdict: 'verified' | 'regression' | 'skipped';
  template: 'react-vite/default-ts';
  storyIds: string[];
  capture: CaptureMetadata;
  durations: Durations;
  createdAt: string;
}

export interface CaptureResult {
  pageErrors: string[];
  consoleErrors: string[];
  errorDisplayHidden: boolean;
  previewHasChildren: boolean;
  screenshotPath: string;
}

export interface RunPaths {
  runId: string;
  runDir: string;
  resultJson: string;
  screenshotManager: string;
  consoleLog: string;
}

export function buildRunPaths(runId?: string, baseDir?: string): RunPaths {
  const resolvedBaseDir = baseDir ?? path.resolve(process.cwd(), '.verify-output');
  const resolvedRunId =
    runId ??
    new Date()
      .toISOString()
      .replace(/:/g, '-')
      .replace(/\.\d{3}Z$/, (m) => m);
  const runDir = path.join(resolvedBaseDir, resolvedRunId);
  return {
    runId: resolvedRunId,
    runDir,
    resultJson: path.join(runDir, 'verify-result.json'),
    screenshotManager: path.join(runDir, 'screenshot-manager.png'),
    consoleLog: path.join(runDir, 'console.log'),
  };
}

export async function ensureRunDir(paths: RunPaths): Promise<void> {
  await fs.mkdir(paths.runDir, { recursive: true });
}

export async function writeResult(paths: RunPaths, result: VerifyResult): Promise<void> {
  await ensureRunDir(paths);
  await fs.writeFile(paths.resultJson, JSON.stringify(result, null, 2) + '\n', 'utf-8');
}

export function computeVerdict(c: CaptureResult): 'verified' | 'regression' {
  if (
    c.pageErrors.length === 0 &&
    c.consoleErrors.length === 0 &&
    c.errorDisplayHidden === true &&
    c.previewHasChildren === true
  ) {
    return 'verified';
  }
  return 'regression';
}

export async function pruneOldRuns(maxRuns = 10, baseDir?: string): Promise<void> {
  const resolvedBaseDir = baseDir ?? path.resolve(process.cwd(), '.verify-output');
  try {
    let entries: string[];
    try {
      const dirents = await fs.readdir(resolvedBaseDir, { withFileTypes: true });
      entries = dirents
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
        .reverse();
    } catch (e: any) {
      if (e?.code === 'ENOENT') return;
      throw e;
    }
    const toDelete = entries.slice(maxRuns);
    for (const name of toDelete) {
      await fs.rm(path.join(resolvedBaseDir, name), { recursive: true, force: true });
    }
  } catch (err) {
    console.error('[pruneOldRuns] error:', err);
  }
}
