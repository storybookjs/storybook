import { resolve } from "node:path";
import pc from "picocolors";
import { x } from "tinyexec";

export const REPO_ROOT = resolve(import.meta.dirname, "..", "..", "..");
export const EVAL_ROOT = resolve(REPO_ROOT, "..", "storybook-eval");
export const CACHE_DIR = resolve(EVAL_ROOT, ".cache", "repos");
export const TRIALS_DIR = resolve(EVAL_ROOT, "trials");
export const PROMPTS_DIR = resolve(import.meta.dirname, "..", "prompts");

// --- Logging ---

export const log = (msg: string) => console.log(msg);
export const logStep = (msg: string) => console.log(`  ${pc.cyan(">")} ${msg}`);
export const logSuccess = (msg: string) => console.log(`  ${pc.green("✓")} ${msg}`);
export const logError = (msg: string) => console.log(`  ${pc.red("✗")} ${msg}`);

export const formatDuration = (s: number) =>
  s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;

export const formatCost = (cost?: number) => (cost == null ? "-" : `$${cost.toFixed(2)}`);

export function generateTrialId(project: string, agent: string, model: string) {
  return `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}-${project}-${agent}-${model}`;
}

// --- Clean npm env ---

/**
 * Process env with verdaccio registry overrides stripped.
 * The storybook monorepo's .npmrc points to localhost:6002.
 */
export function cleanEnv(): Record<string, string | undefined> {
  const env = { ...process.env };
  env.npm_config_registry = "https://registry.npmjs.org/";
  for (const key of Object.keys(env)) {
    if (key.startsWith("npm_config_") && key !== "npm_config_registry") {
      delete env[key];
    }
  }
  return env;
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
