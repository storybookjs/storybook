import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve, basename, join } from 'node:path';
import pc from 'picocolors';
import { x } from 'tinyexec';

export interface Logger {
  log: (msg: string) => void;
  logStep: (msg: string) => void;
  logSuccess: (msg: string) => void;
  logError: (msg: string) => void;
}

export const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
export const EVAL_ROOT = resolve(REPO_ROOT, '..', 'storybook-eval');
export const CACHE_DIR = resolve(EVAL_ROOT, '.cache', 'repos');
export const TRIALS_DIR = resolve(EVAL_ROOT, 'trials');
export const PROMPTS_DIR = resolve(import.meta.dirname, '..', 'prompts');

export function createLogger(prefix?: string): Logger {
  const p = prefix ? pc.dim(`[${prefix}]`) + ' ' : '';
  return {
    log: (msg: string) => console.log(`${p}${msg}`),
    logStep: (msg: string) => console.log(`${p}  ${pc.cyan('>')} ${msg}`),
    logSuccess: (msg: string) => console.log(`${p}  ${pc.green('✓')} ${msg}`),
    logError: (msg: string) => console.log(`${p}  ${pc.red('✗')} ${msg}`),
  };
}

export const formatDuration = (s: number) =>
  s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;

export const formatCost = (cost?: number) => (cost == null ? '-' : `$${cost.toFixed(2)}`);

export function generateTrialId(project: string, agent: string, model: string, prompt: string) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${ts}-${project}-${agent}-${model}-${prompt}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Format data as an aligned table with automatic column widths. */
export function formatTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => stripAnsi(r[i] ?? '').length))
  );

  const pad = (str: string, width: number) => {
    const visible = stripAnsi(str).length;
    return str + ' '.repeat(Math.max(0, width - visible));
  };

  const sep = ' | ';
  return [
    headers.map((h, i) => pad(h, widths[i])).join(sep),
    widths.map((w) => '-'.repeat(w)).join('-+-'),
    ...rows.map((row) => row.map((cell, i) => pad(cell, widths[i])).join(sep)),
  ].join('\n');
}

/** Load a prompt by name from prompts/{name}.md. */
export function loadPrompt(name = 'setup'): string {
  const file = resolve(PROMPTS_DIR, `${name}.md`);
  if (!existsSync(file)) {
    throw new Error(`Prompt not found: ${file}\nAvailable: ${listPrompts().join(', ')}`);
  }
  return readFileSync(file, 'utf-8').trim();
}

/** List available prompt names. */
export function listPrompts(): string[] {
  if (!existsSync(PROMPTS_DIR)) return [];
  return readdirSync(PROMPTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => basename(f, '.md'));
}

export interface EvalEnvironment {
  nodeVersion: string;
  /** Git branch of the eval harness (storybook monorepo), not the evaluated project. */
  evalBranch: string;
  /** Git commit of the eval harness (storybook monorepo), not the evaluated project. */
  evalCommit: string;
}

export async function captureEnvironment(resultsDir: string): Promise<EvalEnvironment> {
  let evalBranch = 'unknown';
  let evalCommit = 'unknown';
  try {
    evalBranch = (await x('git', ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
    evalCommit = (await x('git', ['rev-parse', 'HEAD'])).stdout.trim();
  } catch {
    /* not in a git repo */
  }
  const env: EvalEnvironment = { nodeVersion: process.version, evalBranch, evalCommit };
  await writeFile(join(resultsDir, 'environment.json'), JSON.stringify(env, null, 2));
  return env;
}

/** Strip ANSI escape codes for accurate width calculation. */
function stripAnsi(str: string) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
