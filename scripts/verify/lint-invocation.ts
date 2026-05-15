// Scoped ESLint invocation for agent-generated recipe specs.
//
// The recipe authoring flow needs a strict, isolated lint profile (TS no-unused-vars
// at error severity) that does not inherit the repo-wide ESLint config. The default
// resolution chain would pick up `.verify-recipes/`'s parent configs and the dotfile
// directory ignore — both unwanted here. We pin the config explicitly, disable
// dotfile-directory ignore, and resolve the eslint binary via the package.json
// (the `bin/eslint.js` subpath is blocked by eslint's exports field).

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pickEnv } from '../utils/env.ts';

const requireFromHere = createRequire(import.meta.url);

export interface RuleViolation {
  ruleId: string | null;
  messages: Array<{
    ruleId: string | null;
    severity: number;
    message: string;
    line?: number;
    column?: number;
  }>;
}

export interface LintInvocationResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  ruleViolations: RuleViolation[];
  rawJson: unknown;
}

export interface LintRecipeSpecOptions {
  specPath: string;
  repoRoot?: string;
}

const REPO_ROOT_DEFAULT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function resolveEslintBin(): string {
  const eslintPkgPath = requireFromHere.resolve('eslint/package.json');
  return path.join(path.dirname(eslintPkgPath), 'bin', 'eslint.js');
}

function buildArgs(specPath: string, repoRoot: string): string[] {
  const configPath = path.join(repoRoot, '.verify-recipes', '.eslintrc.cjs');
  const pluginsRoot = path.join(repoRoot, 'node_modules');
  return [
    '--no-eslintrc',
    '--config',
    configPath,
    '--no-ignore',
    '--resolve-plugins-relative-to',
    pluginsRoot,
    '--format',
    'json',
    specPath,
  ];
}

function collectViolations(rawJson: unknown): RuleViolation[] {
  if (!Array.isArray(rawJson)) {
    return [];
  }
  const out: RuleViolation[] = [];
  for (const entry of rawJson) {
    if (!entry || typeof entry !== 'object') continue;
    const messages = Array.isArray((entry as { messages?: unknown }).messages)
      ? (entry as { messages: RuleViolation['messages'] }).messages
      : [];
    for (const msg of messages) {
      out.push({ ruleId: msg.ruleId ?? null, messages: [msg] });
    }
  }
  return out;
}

function hasErrorSeverity(rawJson: unknown): boolean {
  if (!Array.isArray(rawJson)) return false;
  for (const entry of rawJson) {
    if (entry && typeof entry === 'object') {
      const errorCount = (entry as { errorCount?: number }).errorCount ?? 0;
      if (errorCount > 0) return true;
    }
  }
  return false;
}

export async function lintRecipeSpec(
  options: LintRecipeSpecOptions
): Promise<LintInvocationResult> {
  const repoRoot = options.repoRoot ?? REPO_ROOT_DEFAULT;
  const absSpecPath = path.isAbsolute(options.specPath)
    ? options.specPath
    : path.resolve(repoRoot, options.specPath);

  // Ensure the local `eslint-plugin-verify-recipes` (lives under
  // .verify-recipes/eslint-plugin/) is reachable via `node_modules` for
  // ESLint's plugin resolver. The plugin is not published to npm and not a
  // yarn workspace package, so we symlink it on demand. Idempotent.
  const pluginsRootDir = path.join(repoRoot, 'node_modules');
  const pluginLinkPath = path.join(pluginsRootDir, 'eslint-plugin-verify-recipes');
  const pluginSrcPath = path.join(repoRoot, '.verify-recipes', 'eslint-plugin');
  if (!fs.existsSync(pluginLinkPath) && fs.existsSync(pluginSrcPath)) {
    try {
      fs.mkdirSync(pluginsRootDir, { recursive: true });
      fs.symlinkSync(pluginSrcPath, pluginLinkPath, 'dir');
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') {
        throw err;
      }
    }
  }

  const eslintBin = resolveEslintBin();
  const args = buildArgs(absSpecPath, repoRoot);

  const { exitCode, stdout, stderr } = await new Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    const child = spawn(process.execPath, [eslintBin, ...args], {
      cwd: repoRoot,
      env: pickEnv({
        allow: [
          'PATH',
          'HOME',
          'RUNNER_TEMP',
          'VERIFY_RUN_DIR',
          'STORYBOOK_URL',
          'NODE_OPTIONS',
          'CI',
          'NODE_ENV',
        ],
      }),
    });
    let stdoutBuf = '';
    let stderrBuf = '';
    child.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString('utf8');
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      resolve({ exitCode: code ?? 0, stdout: stdoutBuf, stderr: stderrBuf });
    });
  });

  let rawJson: unknown = null;
  if (stdout.trim()) {
    try {
      rawJson = JSON.parse(stdout);
    } catch {
      rawJson = null;
    }
  }

  const ruleViolations = collectViolations(rawJson);
  const isErrorOnly = hasErrorSeverity(rawJson);

  // ESLint returns exit 1 on lint errors and 2 on operational errors. We only
  // want to fail on actual error-severity rule violations; warnings alone must
  // not flunk the gate.
  const effectiveExit = isErrorOnly ? exitCode || 1 : exitCode === 2 ? 2 : 0;

  return {
    exitCode: effectiveExit,
    stdout,
    stderr,
    ruleViolations,
    rawJson,
  };
}

// UC14 (PR #34762): the retry policy (max attempts, ESLint rule -> bucket
// table, retry-message formatter) is inlined directly into
// `recipe-author-core.ts`. The previous standalone `recipe-retry-policy.ts`
// module was deleted; `MAX_RECIPE_ATTEMPTS` is the canonical export.
