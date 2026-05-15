// Shared types, run-path math, verdict computation, and run pruning for the PR verify harness.

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { createHmac, timingSafeEqual } from 'node:crypto';

import type { VerifyMode } from './mode.ts';

export const SCHEMA_VERSION = 2;

// CSI / SGR ANSI escape stripper shared by entry script + CI helpers so log
// tails render cleanly in PR comments.
export const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;
export function stripAnsi(input: string): string {
  return input.replace(ANSI_RE, '');
}

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
  notes?: string[];
  regressionReason?: string;
  /**
   * Long-form context for the regression (compile/boot output tail, error
   * trace, etc). Rendered by the PR-comment formatter inside a collapsible
   * `<details>` block when present.
   */
  regressionDetails?: string;
  /**
   * v6 widened: `internal-ui` (default monorepo-UI target) or a sandbox
   * template such as `react-vite/default-ts`.
   */
  template: string;
  /**
   * v7: verdict strategy parsed from the recipe's `@verify-mode` header by
   * the trusted orchestrator (default `visual`). Signed (see SIGNED_FIELDS)
   * so a forged in-srt result cannot claim a non-visual mode to dodge the
   * vision evidence-check. Downstream trusted steps branch on this.
   */
  mode?: VerifyMode;
  storyIds: string[];
  recipeSpecPath: string;
  tests: RecipeTest[];
  traceZipPaths: string[];
  durations: Durations;
  createdAt: string;
}

export interface RunPaths {
  runId: string;
  runDir: string;
  resultJson: string;
  consoleLog: string;
}

export function buildRunPaths(runId?: string, baseDir?: string): RunPaths {
  const resolvedBaseDir = baseDir ?? path.resolve(process.cwd(), '.verify-output');
  const resolvedRunId = runId ?? new Date().toISOString().replace(/:/g, '-');
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

// C1 fix: subset of fields HMAC covers. Trusted post-processors (vision
// evidence-check, retry annotation, unit-tests merge) add fields OUTSIDE
// this set, so they don't need the signing secret. A recipe inside srt
// flipping `verdict` from regression→verified will invalidate the HMAC,
// and trusted derive-verdict downgrades the verdict back to regression.
const SIGNED_FIELDS = [
  'schemaVersion',
  'runId',
  'verdict',
  'template',
  'mode',
  'recipeSpecPath',
  'tests',
  'traceZipPaths',
  'regressionReason',
] as const;

export function signablePayload(result: Partial<VerifyResult>): string {
  const subset: Record<string, unknown> = {};
  for (const k of SIGNED_FIELDS) {
    if ((result as Record<string, unknown>)[k] !== undefined) {
      subset[k] = (result as Record<string, unknown>)[k];
    }
  }
  return JSON.stringify(subset);
}

export function signResult(result: Partial<VerifyResult>, secret: string): string {
  return createHmac('sha256', secret).update(signablePayload(result)).digest('hex');
}

export function verifyResultSignature(
  result: Partial<VerifyResult>,
  signatureHex: string,
  secret: string
): boolean {
  const expected = signResult(result, secret);
  if (expected.length !== signatureHex.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}

function sigPathFor(resultJsonPath: string): string {
  return resultJsonPath + '.sig';
}

export async function writeResult(
  paths: RunPaths,
  result: VerifyResult,
  outputDir?: string,
  secret?: string
): Promise<void> {
  const resultJson = outputDir ? path.join(outputDir, 'verify-result.json') : paths.resultJson;
  await fs.mkdir(path.dirname(resultJson), { recursive: true });
  await fs.writeFile(resultJson, JSON.stringify(result, null, 2) + '\n', 'utf-8');
  if (secret) {
    await fs.writeFile(sigPathFor(resultJson), signResult(result, secret) + '\n', 'utf-8');
  }
}

export function appendNote(result: VerifyResult, note: string): void {
  result.notes ??= [];
  result.notes.push(note);
}

/**
 * Write a synthetic `regression` verdict with a structured reason. Used for
 * harness-level abort conditions (head-sha drift, head-sha file missing) where
 * the recipe never executed. The runner exits non-zero after calling this.
 */
export async function writeRegressionResult(
  paths: RunPaths,
  reason: string,
  opts?: {
    template?: string;
    /** Long-form context (compile/boot output tail) for the PR comment. */
    details?: string;
    recipeSpecPath?: string;
    durations?: Durations;
  },
  outputDir?: string,
  secret?: string
): Promise<void> {
  const result: VerifyResult = {
    schemaVersion: SCHEMA_VERSION,
    runId: paths.runId,
    verdict: 'regression',
    regressionReason: reason,
    template: opts?.template ?? 'internal-ui',
    storyIds: [],
    recipeSpecPath: opts?.recipeSpecPath ?? '',
    tests: [],
    traceZipPaths: [],
    durations: opts?.durations ?? {
      compileMs: 0,
      symlinkMs: 0,
      bootMs: 0,
      recipeMs: 0,
      totalMs: 0,
    },
    createdAt: new Date().toISOString(),
  };
  if (opts?.details && opts.details.length > 0) {
    result.regressionDetails = opts.details;
  }
  await writeResult(paths, result, outputDir, secret);
}

export function computeVerdict(tests: RecipeTest[]): 'verified' | 'regression' {
  // Zero tests ran ⇒ regression (covers spec-import-error case where Playwright loads zero specs).
  if (tests.length === 0) {
    return 'regression';
  }
  for (const t of tests) {
    if (t.status !== 'passed') return 'regression';
    const significantPageErrors = t.pageErrors.filter((m) => !isLowSignalPageError(m));
    if (significantPageErrors.length > 0) return 'regression';
    const significantConsoleErrors = t.consoleErrors.filter((m) => !isLowSignalConsoleError(m));
    if (significantConsoleErrors.length > 0) return 'regression';
  }
  return 'verified';
}

/**
 * Generic Chromium resource-load failures ("Failed to load resource: …")
 * are low-signal noise — favicon misses, dev-mode source-map probes,
 * Storybook composition refs that 404 in CI, etc. Real PR regressions
 * surface via pageErrors (uncaught JS exceptions) or test failures.
 * Drop these from the regression gate so a clean story render doesn't
 * get flagged on benign browser-side fetch misses.
 */
function isLowSignalConsoleError(text: string): boolean {
  return /^Failed to load resource:/.test(text);
}

/**
 * Low-signal pageErrors that surface on the manager page through
 * environment quirks rather than the PR's diff:
 *  - `SecurityError: Failed to read the 'sessionStorage' property from
 *    'Window': Access is denied for this document.` — `@storybook/addon-mcp`
 *    probes cross-origin composed refs (e.g. chromatic-hosted iframes) and
 *    triggers a Window.sessionStorage getter denial. Pre-existing in the
 *    upstream addon; surfaced only when internal-ui loads composed refs.
 *    Real PR regressions do not surface this way.
 */
function isLowSignalPageError(text: string): boolean {
  return /SecurityError:\s*Failed to read the 'sessionStorage' property from 'Window'/.test(text);
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
