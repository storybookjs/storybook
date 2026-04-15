import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { basename, join, resolve, sep } from 'node:path';
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
export const REPOS_DIR = resolve(EVAL_ROOT, 'repos');
export const TRIALS_DIR = resolve(EVAL_ROOT, 'trials');
export const PROMPTS_DIR = resolve(import.meta.dirname, '..', 'prompts');
export const STORYBOOK_DIRNAME = '.storybook';
export const EVAL_RESULTS_DIRNAME = 'eval-results';

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

/** Raw 0-1 index (used in data.json and when you need the exact ratio). */
export const formatScore = (score: number) =>
  score.toFixed(3).replace(/(?:\.0+|(\.\d*?)0+)$/, '$1');

/** Human-readable percentage for the same 0-1 score (data.json keeps the ratio). */
export function formatScorePercent(score: number): string {
  if (!Number.isFinite(score)) return String(score);
  const pct = score * 100;
  const rounded = Math.round(pct);
  if (Math.abs(pct - rounded) < 1e-6) return `${rounded}%`;
  return `${pct.toFixed(1)}%`;
}

export function getProjectPath(repoRoot: string, projectDir?: string) {
  return projectDir ? join(repoRoot, projectDir) : repoRoot;
}

export function getStorybookDir(projectPath: string) {
  return join(projectPath, STORYBOOK_DIRNAME);
}

export function getEvalSupportDir(projectPath: string) {
  return join(getStorybookDir(projectPath), 'eval-support');
}

export function getEvalResultsDir(projectPath: string) {
  return join(getStorybookDir(projectPath), EVAL_RESULTS_DIRNAME);
}

export function getEvalResultsRelativeDir(projectDir?: string) {
  return toPosixPath(
    projectDir
      ? join(projectDir, STORYBOOK_DIRNAME, EVAL_RESULTS_DIRNAME)
      : join(STORYBOOK_DIRNAME, EVAL_RESULTS_DIRNAME)
  );
}

export function getEvalResultsRelativePath(fileName: string, projectDir?: string) {
  return `${getEvalResultsRelativeDir(projectDir)}/${fileName}`;
}

export function generateTrialId() {
  const timestamp = new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/:/g, '-');
  return `${timestamp}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

export function formatReadableUtcTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  const month = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ][date.getUTCMonth()];
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  const hour = `${date.getUTCHours()}`.padStart(2, '0');
  const minute = `${date.getUTCMinutes()}`.padStart(2, '0');
  const second = `${date.getUTCSeconds()}`.padStart(2, '0');
  return `${month} ${day} ${year} ${hour}:${minute}:${second} UTC`;
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
export function loadPrompt(name = 'pattern-copy-play'): string {
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

export async function captureEnvironment(): Promise<EvalEnvironment> {
  let evalBranch = 'unknown';
  let evalCommit = 'unknown';
  try {
    evalBranch = (await x('git', ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
    evalCommit = (await x('git', ['rev-parse', 'HEAD'])).stdout.trim();
  } catch {
    /* not in a git repo */
  }
  return { nodeVersion: process.version, evalBranch, evalCommit };
}

export interface HelpOption {
  type: 'string' | 'boolean';
  short?: string;
  description?: string;
}

/**
 * Format a --help message from the same options object passed to parseArgs.
 * Each option may carry a `description` field (ignored by parseArgs at runtime).
 */
export function formatHelp(
  usage: string,
  description: string,
  options: Record<string, HelpOption>
): string {
  const entries = Object.entries(options);

  const formatted = entries.map(([name, opt]) => {
    const short = opt.short ? `-${opt.short}, ` : '    ';
    const long = opt.type === 'string' ? `--${name} <value>` : `--${name}`;
    return { short, long, desc: opt.description ?? '' };
  });

  const maxLong = Math.max(...formatted.map((f) => f.long.length));

  return [
    `Usage: ${usage}`,
    '',
    description,
    '',
    'Options:',
    ...formatted.map((f) => `  ${f.short}${f.long.padEnd(maxLong)}  ${f.desc}`),
  ].join('\n');
}

/** Strip ANSI escape codes for accurate width calculation. */
function stripAnsi(str: string) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function toPosixPath(value: string) {
  return value.split(sep).join('/');
}
