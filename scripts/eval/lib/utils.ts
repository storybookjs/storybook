import { resolve } from 'node:path';
import pc from 'picocolors';
import { x } from 'tinyexec';

/** Root of the storybook monorepo */
export const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');

/** Directory for eval trials and caches (outside the monorepo to avoid workspace interference) */
export const EVAL_ROOT = resolve(REPO_ROOT, '..', 'storybook-eval');

/** Cached repo clones */
export const CACHE_DIR = resolve(EVAL_ROOT, '.cache', 'repos');

/** Trial output base directory */
export const TRIALS_DIR = resolve(EVAL_ROOT, 'trials');

/** Built-in prompts directory */
export const PROMPTS_DIR = resolve(import.meta.dirname, '..', 'prompts');

export function log(msg: string) {
  console.log(msg);
}

export function logStep(msg: string) {
  console.log(`  ${pc.cyan('>')} ${msg}`);
}

export function logSuccess(msg: string) {
  console.log(`  ${pc.green('✓')} ${msg}`);
}

export function logError(msg: string) {
  console.log(`  ${pc.red('✗')} ${msg}`);
}

export function logWarn(msg: string) {
  console.log(`  ${pc.yellow('!')} ${msg}`);
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m${secs}s`;
}

export function formatCost(cost?: number): string {
  if (cost == null) return '-';
  return `$${cost.toFixed(2)}`;
}

export function generateTrialId(projectName: string, agent: string, model: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${timestamp}-${projectName}-${agent}-${model}`;
}

/** Options for the exec helper */
interface ExecOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeout?: number;
  /** If true, don't throw on non-zero exit code (default: true = throw) */
  throwOnError?: boolean;
  /** Set to 'ignore' to suppress stdin */
  stdin?: 'ignore';
}

/** Result from exec helper */
export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

/**
 * Thin wrapper around tinyexec's `x()` with timeout support via AbortController.
 */
export async function exec(
  command: string,
  args: string[],
  options: ExecOptions = {}
): Promise<ExecResult> {
  const { cwd, env, timeout, throwOnError = true, stdin } = options;

  const controller = timeout ? new AbortController() : undefined;
  const timer = timeout
    ? setTimeout(() => controller!.abort(), timeout)
    : undefined;

  const stdio = stdin === 'ignore'
    ? (['ignore', 'pipe', 'pipe'] as const)
    : undefined;

  try {
    const result = await x(command, args, {
      throwOnError: false,
      nodeOptions: {
        cwd,
        env: env as NodeJS.ProcessEnv,
        signal: controller?.signal,
        ...(stdio ? { stdio } : {}),
      },
    });

    if (throwOnError && result.exitCode !== 0) {
      const msg = `Command failed: ${command} ${args.join(' ')}\n${result.stderr}`;
      throw new Error(msg);
    }

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
