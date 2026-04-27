import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, readFileSync, unlinkSync, watchFile, unwatchFile, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.join(__dirname, '..', '..');
const CODE_DIR = path.join(REPO_ROOT, 'code');

interface RunResult {
  coldStartMs: number;
}

async function waitForMarkerLine(
  filePath: string,
  status: string,
  timeoutMs: number
): Promise<number> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unwatchFile(filePath);
      reject(new Error(`Timeout waiting for marker '${status}' at ${filePath}`));
    }, timeoutMs);

    const check = () => {
      try {
        const content = readFileSync(filePath, 'utf-8');
        for (const line of content.split('\n')) {
          if (!line) continue;
          try {
            const obj = JSON.parse(line) as { status?: string; ts?: number };
            if (obj.status === status && typeof obj.ts === 'number') {
              clearTimeout(timer);
              unwatchFile(filePath);
              resolve(obj.ts);
              return;
            }
          } catch {
            /* partial line, ignore */
          }
        }
      } catch {
        /* file not yet present */
      }
    };

    watchFile(filePath, { interval: 50 }, check);
    check(); // also check immediately
  });
}

async function killGracefully(child: ChildProcess, graceMs: number): Promise<void> {
  if (!child.pid || child.exitCode !== null) return;
  child.kill('SIGTERM');
  const exited = await Promise.race([
    new Promise<boolean>((resolve) => child.once('exit', () => resolve(true))),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), graceMs)),
  ]);
  if (!exited && child.exitCode === null) {
    child.kill('SIGKILL');
    await new Promise<void>((resolve) => child.once('exit', () => resolve()));
  }
}

async function singleRun(): Promise<RunResult> {
  const markerPath = path.join(
    tmpdir(),
    `storybook-bench-marker-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`
  );
  try {
    unlinkSync(markerPath);
  } catch {
    /* file doesn't exist yet, that's fine */
  }

  const startedAt = Date.now();
  const child = spawn('yarn', ['storybook:ui'], {
    cwd: CODE_DIR,
    env: {
      ...process.env,
      STORYBOOK_BENCH_MARKER: markerPath,
      STORYBOOK_DISABLE_TELEMETRY: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Drain stdout/stderr to avoid blocking the subprocess
  child.stdout?.resume();
  child.stderr?.resume();

  try {
    const readyAt = await waitForMarkerLine(markerPath, 'ready', 120_000);
    return { coldStartMs: readyAt - startedAt };
  } finally {
    await killGracefully(child, 2000);
    try {
      unlinkSync(markerPath);
    } catch {
      /* already gone */
    }
  }
}

function median(xs: number[]): number {
  if (xs.length === 0) return -1;
  const sorted = xs.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function getCurrentBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    }).trim();
  } catch {
    return 'unknown';
  }
}

function getCurrentSha(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

async function main() {
  const N = 5;
  const runs: RunResult[] = [];

  for (let i = 0; i < N; i++) {
    process.stdout.write(`Run ${i + 1}/${N}... `);
    try {
      const r = await singleRun();
      runs.push(r);
      process.stdout.write(`cold-start=${r.coldStartMs}ms\n`);
    } catch (e) {
      process.stderr.write(`FAILED: ${(e as Error).message}\n`);
      process.exit(1);
    }
  }

  const result = {
    timestamp: new Date().toISOString(),
    git: {
      branch: getCurrentBranch(),
      sha: getCurrentSha(),
    },
    runs,
    median: {
      coldStartMs: median(runs.map((r) => r.coldStartMs)),
    },
  };

  const outDir = path.join(REPO_ROOT, 'scripts', 'bench', 'results');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `change-detection-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`Result written: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
