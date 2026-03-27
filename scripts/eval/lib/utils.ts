import { resolve } from "node:path";
import pc from "picocolors";
import { x } from "tinyexec";

export const REPO_ROOT = resolve(import.meta.dirname, "..", "..", "..");
export const EVAL_ROOT = resolve(REPO_ROOT, "..", "storybook-eval");
export const CACHE_DIR = resolve(EVAL_ROOT, ".cache", "repos");
export const TRIALS_DIR = resolve(EVAL_ROOT, "trials");
export const PROMPTS_DIR = resolve(import.meta.dirname, "..", "prompts");

// --- Logging ---

export function createLogger(prefix?: string) {
  const p = prefix ? pc.dim(`[${prefix}]`) + " " : "";
  return {
    log: (msg: string) => console.log(`${p}${msg}`),
    logStep: (msg: string) => console.log(`${p}  ${pc.cyan(">")} ${msg}`),
    logSuccess: (msg: string) => console.log(`${p}  ${pc.green("✓")} ${msg}`),
    logError: (msg: string) => console.log(`${p}  ${pc.red("✗")} ${msg}`),
  };
}

export type Logger = ReturnType<typeof createLogger>;

// Default logger (no prefix) for single-run mode
const defaultLogger = createLogger();
export const log = defaultLogger.log;
export const logStep = defaultLogger.logStep;
export const logSuccess = defaultLogger.logSuccess;
export const logError = defaultLogger.logError;

export const formatDuration = (s: number) =>
  s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;

export const formatCost = (cost?: number) => (cost == null ? "-" : `$${cost.toFixed(2)}`);

export function generateTrialId(project: string, agent: string, model: string) {
  return `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}-${project}-${agent}-${model}`;
}

// --- Exec ---

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export async function exec(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string | undefined>;
    timeout?: number;
    throwOnError?: boolean;
    stdin?: "ignore";
  } = {},
): Promise<ExecResult> {
  const { cwd, env, timeout, throwOnError = true, stdin } = options;
  const controller = timeout ? new AbortController() : undefined;
  const timer = timeout ? setTimeout(() => controller!.abort(), timeout) : undefined;
  const stdio: ["ignore", "pipe", "pipe"] | undefined =
    stdin === "ignore" ? ["ignore", "pipe", "pipe"] : undefined;

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
      throw new Error(`Command failed: ${command} ${args.join(" ")}\n${result.stderr}`);
    }
    return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
