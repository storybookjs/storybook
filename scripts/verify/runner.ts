import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

import type { RunPaths } from './core.ts';

export interface RunRecipeOptions {
  specPath: string;
  baseURL: string;
  runPaths: RunPaths;
  controller?: AbortController;
}

export interface RunRecipeResult {
  exitCode: number;
  reportPath: string;
  traceZipPaths: string[];
}

const repoRoot = path.resolve(import.meta.dirname, '../..');
const configPath = path.resolve(import.meta.dirname, 'playwright.config.ts');

export async function runRecipe(options: RunRecipeOptions): Promise<RunRecipeResult> {
  const { specPath, baseURL, runPaths, controller } = options;
  const reportPath = path.join(runPaths.runDir, 'playwright-report.json');

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn('bun', ['x', 'playwright', 'test', specPath, '--config', configPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        VERIFY_RUN_DIR: runPaths.runDir,
        STORYBOOK_URL: baseURL,
      },
      signal: controller?.signal,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (chunk: Buffer) => {
      process.stdout.write(prefixLines('[runner]', chunk.toString('utf-8')));
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(prefixLines('[runner]', chunk.toString('utf-8')));
    });

    child.on('error', (err) => {
      reject(err);
    });
    child.on('close', (code) => {
      resolve(code ?? 1);
    });
  });

  // Discover trace.zip paths via JSON report attachments only — no filesystem glob.
  const traceZipPaths = await discoverTraceZipPaths(reportPath);

  return { exitCode, reportPath, traceZipPaths };
}

async function discoverTraceZipPaths(reportPath: string): Promise<string[]> {
  let raw: string;
  try {
    raw = await fs.readFile(reportPath, 'utf-8');
  } catch (err: any) {
    throw new Error(
      `[runner] Playwright JSON report missing at ${reportPath}: ${err?.message ?? err}`
    );
  }

  let report: any;
  try {
    report = JSON.parse(raw);
  } catch (err: any) {
    throw new Error(
      `[runner] Playwright JSON report at ${reportPath} is not valid JSON: ${err?.message ?? err}`
    );
  }

  if (!Array.isArray(report?.suites)) {
    throw new Error(`[runner] Playwright JSON report at ${reportPath} missing "suites" array`);
  }

  const traces: string[] = [];
  for (const suite of report.suites) {
    collectTraces(suite, traces);
  }

  if (traces.length === 0) {
    throw new Error(
      `[runner] Playwright JSON report at ${reportPath} has no trace attachments — runner contract violated`
    );
  }

  return traces;
}

function collectTraces(node: any, out: string[]): void {
  if (Array.isArray(node?.suites)) {
    for (const child of node.suites) collectTraces(child, out);
  }
  if (Array.isArray(node?.specs)) {
    for (const spec of node.specs) {
      if (!Array.isArray(spec?.tests)) continue;
      for (const test of spec.tests) {
        if (!Array.isArray(test?.results)) continue;
        for (const result of test.results) {
          if (!Array.isArray(result?.attachments)) continue;
          for (const att of result.attachments) {
            if (att?.name === 'trace' && typeof att?.path === 'string') {
              out.push(att.path);
            }
          }
        }
      }
    }
  }
}

function prefixLines(prefix: string, text: string): string {
  return text
    .split('\n')
    .map((line, idx, arr) => (idx === arr.length - 1 && line === '' ? '' : `${prefix} ${line}\n`))
    .join('');
}
