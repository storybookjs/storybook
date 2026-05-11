// Shared types, run-path math, verdict computation, and run pruning for the PR verify harness.

import * as path from 'node:path';
import * as fs from 'node:fs/promises';

export const SCHEMA_VERSION = 2;

export type StepStatus = 'passed' | 'failed' | 'skipped' | 'timedOut';

export interface RecipeStep {
  title: string;
  status: StepStatus;
  durationMs: number;
  error?: string;
}

export interface RecipeTest {
  specPath: string;
  title: string;
  status: StepStatus;
  steps: RecipeStep[];
  pageErrors: string[];
  consoleErrors: string[];
  traceZipPath?: string;
}

export interface Durations {
  compileMs?: number;
  symlinkMs?: number;
  bootMs?: number;
  recipeMs?: number;
  totalMs: number;
}

export interface VerifyResult {
  schemaVersion: number;
  runId: string;
  verdict: 'verified' | 'regression' | 'skipped';
  regressionReason?: string;
  template: 'react-vite/default-ts';
  storyIds: string[];
  recipeSpecPath: string;
  tests: RecipeTest[];
  traceZipPaths: string[];
  durations: Durations;
  createdAt: string;
  inContainer?: boolean;
  imageDigest?: string | null;
  headSha?: string | null;
}

export interface RunPaths {
  runId: string;
  runDir: string;
  resultJson: string;
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

/**
 * Write a synthetic `regression` verdict with a structured reason. Used for
 * harness-level abort conditions (head-sha drift, head-sha file missing) where
 * the recipe never executed. The runner exits non-zero after calling this.
 */
export async function writeRegressionResult(
  paths: RunPaths,
  reason: string,
  opts?: { headSha?: string; inContainer?: boolean; imageDigest?: string | null }
): Promise<void> {
  const result: VerifyResult = {
    schemaVersion: SCHEMA_VERSION,
    runId: paths.runId,
    verdict: 'regression',
    regressionReason: reason,
    template: 'react-vite/default-ts',
    storyIds: [],
    recipeSpecPath: '',
    tests: [],
    traceZipPaths: [],
    durations: { compileMs: 0, symlinkMs: 0, bootMs: 0, recipeMs: 0, totalMs: 0 },
    createdAt: new Date().toISOString(),
    inContainer: opts?.inContainer,
    imageDigest: opts?.imageDigest ?? null,
    headSha: opts?.headSha,
  };
  await writeResult(paths, result);
}

export function computeVerdict(tests: RecipeTest[]): 'verified' | 'regression' {
  // Zero tests ran ⇒ regression (covers spec-import-error case where Playwright loads zero specs).
  if (tests.length === 0) {
    return 'regression';
  }
  for (const t of tests) {
    if (t.status !== 'passed') return 'regression';
    if (t.pageErrors.length > 0) return 'regression';
    if (t.consoleErrors.length > 0) return 'regression';
  }
  return 'verified';
}

export interface ParsedReport {
  tests: RecipeTest[];
  traceZipPaths: string[];
}

export async function parsePlaywrightReport(reportPath: string): Promise<ParsedReport> {
  let raw: string;
  try {
    raw = await fs.readFile(reportPath, 'utf-8');
  } catch (err: any) {
    throw new Error(
      `[verify] Playwright JSON report missing at ${reportPath}: ${err?.message ?? err}`
    );
  }

  let report: any;
  try {
    report = JSON.parse(raw);
  } catch (err: any) {
    throw new Error(
      `[verify] Playwright JSON report at ${reportPath} is not valid JSON: ${err?.message ?? err}`
    );
  }

  if (!Array.isArray(report?.suites)) {
    throw new Error(`[verify] Playwright JSON report at ${reportPath} missing "suites" array`);
  }

  const tests: RecipeTest[] = [];
  const traceZipPaths: string[] = [];

  for (const suite of report.suites) {
    walkSuite(suite, suite?.file ?? '', tests, traceZipPaths);
  }

  return { tests, traceZipPaths };
}

function walkSuite(node: any, specFile: string, testsOut: RecipeTest[], tracesOut: string[]): void {
  const file = node?.file ?? specFile;
  if (Array.isArray(node?.suites)) {
    for (const child of node.suites) walkSuite(child, file, testsOut, tracesOut);
  }
  if (!Array.isArray(node?.specs)) return;

  for (const spec of node.specs) {
    if (!Array.isArray(spec?.tests)) continue;
    for (const t of spec.tests) {
      if (!Array.isArray(t?.results) || t.results.length === 0) continue;
      // Use last result (final retry).
      const result = t.results[t.results.length - 1];
      const status = normalizeStatus(result?.status ?? t?.status);
      const attachments = Array.isArray(result?.attachments) ? result.attachments : [];

      let tracePath: string | undefined;
      let pageErrors: string[] = [];
      let consoleErrors: string[] = [];

      for (const att of attachments) {
        if (att?.name === 'trace' && typeof att?.path === 'string') {
          tracePath = att.path;
          tracesOut.push(att.path);
        } else if (att?.name === 'pageErrors') {
          pageErrors = decodeJsonArray(att);
        } else if (att?.name === 'consoleErrors') {
          consoleErrors = decodeJsonArray(att);
        }
      }

      const steps: RecipeStep[] = Array.isArray(result?.steps)
        ? result.steps.map((s: any) => ({
            title: String(s?.title ?? ''),
            status: normalizeStatus(s?.error ? 'failed' : 'passed'),
            durationMs: Number(s?.duration ?? 0),
            error: s?.error?.message ? String(s.error.message) : undefined,
          }))
        : [];

      testsOut.push({
        specPath: spec?.file ?? file ?? '',
        title: String(spec?.title ?? t?.projectName ?? ''),
        status,
        steps,
        pageErrors,
        consoleErrors,
        traceZipPath: tracePath,
      });
    }
  }
}

function normalizeStatus(s: any): StepStatus {
  if (s === 'passed' || s === 'failed' || s === 'skipped' || s === 'timedOut') return s;
  if (s === 'ok' || s === 'expected') return 'passed';
  return 'failed';
}

function decodeJsonArray(att: any): string[] {
  try {
    let body: string | undefined;
    if (typeof att?.body === 'string') {
      body = att.body;
    } else if (typeof att?.body === 'object' && att.body?.type === 'Buffer') {
      body = Buffer.from(att.body.data).toString('utf-8');
    } else if (att?.contentType === 'application/json' && typeof att?.path === 'string') {
      // Attachment was written to disk — caller can re-read if needed; skip here.
      return [];
    }
    if (!body) return [];
    // Playwright base64-encodes binary attachments; JSON ones may also be base64.
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      const decoded = Buffer.from(body, 'base64').toString('utf-8');
      parsed = JSON.parse(decoded);
    }
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
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
