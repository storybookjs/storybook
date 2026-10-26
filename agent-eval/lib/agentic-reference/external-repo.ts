// Utilities to setup an external GitHub repo for use in an eval, and to manipulate
// references to external repos.
// Each eval can have a single external repo pinned in its fixture's package.json:
//
//   "evals": { "externalRepo": { "repo": "owner/name", "ref": "<sha>" } }

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import type { Sandbox } from '@vercel/agent-eval';

import { isRecord } from '../utils/type.ts';
import { NODE_DOWNLOAD_SCRIPT } from './sandbox-fetch.ts';

/** Keep interpolated values shell-safe (they land in a bash command). */
const SAFE_GITHUB_PATH = /^[\w./-]+$/;

export interface ExternalRepoPin {
  repo: string;
  ref: string;
}

/** Parse (and sanity-check) an eval's `evals.externalRepo` package.json marker. */
export function parseExternalRepoFromManifest(packageJsonContent: string): ExternalRepoPin {
  const manifest: unknown = JSON.parse(packageJsonContent);
  const evals = isRecord(manifest) ? manifest.evals : undefined;
  const marker = isRecord(evals) ? evals.externalRepo : undefined;

  return typecheckExternalRepo(marker);
}

/** Typecheck and validate an ExternalRepoPin. */
export function typecheckExternalRepo(marker: unknown): ExternalRepoPin {
  if (!isRecord(marker)) {
    throw new Error(
      'externalRepo: fixture package.json has no `evals.externalRepo` marker; ' +
        'expected { "evals": { "externalRepo": { "repo": "owner/name", "ref": "<sha>" } } }'
    );
  }

  const { repo, ref } = marker;
  if (typeof repo !== 'string' || !SAFE_GITHUB_PATH.test(repo)) {
    throw new Error(`externalRepo: evals.externalRepo.repo must match ${String(SAFE_GITHUB_PATH)}`);
  }
  if (typeof ref !== 'string' || !SAFE_GITHUB_PATH.test(ref)) {
    throw new Error(`externalRepo: evals.externalRepo.ref must match ${String(SAFE_GITHUB_PATH)}`);
  }
  return { repo, ref };
}

/**
 * A single directory name for a pin. Both halves have their separators escaped:
 * SAFE_GITHUB_PATH admits refs like `heads/main`, which unescaped would turn the
 * slug into a nested path. SHA pins contain no separator, so existing cache
 * directories keep their names.
 */
export function pinSlug({ repo, ref }: ExternalRepoPin): string {
  return `${repo.replace(/\//g, '__')}@${ref.replace(/\//g, '__')}`;
}

const refCache = new Map<string, string>();

// Both subprocesses are bounded: a stalled codeload connection would otherwise
// hang `yarn results:analyze` indefinitely, and on CI hold the job to its own
// limit. curl's own timeouts fire first so the error names the cause; the
// execFileSync ceilings are the backstop for a process that ignores them.
const CONNECT_TIMEOUT_SECONDS = 30;
// Generous for a ~20MB tarball on a slow link, still far short of a hang.
const FETCH_TIMEOUT_SECONDS = 300;
const EXTRACT_TIMEOUT_SECONDS = 120;

/**
 * Download and extract a ref, returning its directory. Extraction happens in a
 * scratch directory that is renamed into place only once it fully succeeded: a
 * half-populated cache directory would be trusted forever and would quietly
 * skew every later diff.
 */
export function prepareRef(cacheDir: string, repo: string, ref: string): string {
  const slug = pinSlug({ repo, ref });
  const cached = refCache.get(slug);
  if (cached !== undefined) return cached;

  const dir = join(cacheDir, slug);
  if (!existsSync(dir)) {
    mkdirSync(cacheDir, { recursive: true });
    const scratch = `${dir}.partial-${process.pid}`;
    rmSync(scratch, { recursive: true, force: true });
    mkdirSync(scratch, { recursive: true });
    try {
      // execFile, not a shell: repo and ref never reach a command line.
      const tarball = join(scratch, 'source.tar.gz');
      execFileSync(
        'curl',
        [
          '-fsSL',
          '--connect-timeout',
          String(CONNECT_TIMEOUT_SECONDS),
          '--max-time',
          String(FETCH_TIMEOUT_SECONDS),
          '-o',
          tarball,
          `https://codeload.github.com/${repo}/tar.gz/${ref}`,
        ],
        { timeout: (FETCH_TIMEOUT_SECONDS + 30) * 1000 }
      );
      // --strip-components=1 drops the tarball's top-level <name>-<ref>/ dir.
      execFileSync('tar', ['xzf', tarball, '--strip-components=1', '-C', scratch], {
        timeout: EXTRACT_TIMEOUT_SECONDS * 1000,
      });
      rmSync(tarball);
      renameSync(scratch, dir);
    } catch (error) {
      rmSync(scratch, { recursive: true, force: true });
      throw new Error(
        `Failed to fetch ${repo}@${ref}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  refCache.set(slug, dir);
  return dir;
}

// Pin the sandbox @vercel/agent-eval to this package's own version — EVAL.ts
// (via #test-utils) calls its loadTranscript at validation time.
function harnessVersion(): string {
  const rootManifest: unknown = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
  );
  const devDependencies = isRecord(rootManifest) ? rootManifest.devDependencies : undefined;
  const version = isRecord(devDependencies) ? devDependencies['@vercel/agent-eval'] : undefined;
  if (typeof version !== 'string') {
    throw new Error('setupExternalRepo: @vercel/agent-eval missing from agent-eval/package.json');
  }
  return version;
}

// Outside the working directory, so the extraction cannot swallow it.
const SANDBOX_TARBALL_PATH = '/tmp/external-repo.tar.gz';

function exists(sandbox: Sandbox, path: string): Promise<boolean> {
  return sandbox.readFile(path).then(
    () => true,
    () => false
  );
}

async function runOrThrow(
  sandbox: Sandbox,
  command: string,
  args: string[],
  label: string
): Promise<void> {
  const result = await sandbox.runCommand(command, args);
  if (result.exitCode !== 0) {
    const tail = (result.stderr || result.stdout).trim().split('\n').slice(-15).join('\n');
    // 128+signal means the process was killed rather than failing on its own;
    // 137 (SIGKILL) is almost always the container hitting its memory limit,
    // which leaves no error text — the output just stops mid-step.
    const killed =
      result.exitCode === 137 ? ' (exit 137: killed, likely sandbox out of memory)' : '';
    throw new Error(
      `setupExternalRepo: ${label} failed with exit ${result.exitCode}${killed}:\n${tail}`
    );
  }
}

// Install with whichever package manager the repo actually uses. npm-based
// repos need nothing — the harness runs its own `npm install` after setup. Only
// the vendored-Yarn branch has run against a real app.
async function installDependencies(sandbox: Sandbox): Promise<void> {
  const yarnrc = await sandbox.readFile('.yarnrc.yml').catch(() => '');
  const vendoredYarn = /^\s*yarnPath:\s*(\S+)/m.exec(yarnrc)?.[1];
  if (vendoredYarn !== undefined && (await exists(sandbox, vendoredYarn))) {
    await runOrThrow(sandbox, 'node', [vendoredYarn, 'install'], 'vendored yarn install');
    return;
  }

  const usesPnpm = await exists(sandbox, 'pnpm-lock.yaml');
  const usesYarn = await exists(sandbox, 'yarn.lock');
  if (!usesPnpm && !usesYarn) {
    return;
  }

  if ((await sandbox.runCommand('corepack', ['enable'])).exitCode !== 0) {
    await runOrThrow(sandbox, 'npm', ['install', '-g', 'corepack'], 'install corepack');
  }
  await runOrThrow(
    sandbox,
    usesPnpm ? 'pnpm' : 'yarn',
    usesPnpm ? ['install', '--frozen-lockfile'] : ['install'],
    `${usesPnpm ? 'pnpm' : 'yarn'} install`
  );
}

// Extract the repo over the sandbox root, install its deps, then restore the
// harness/template contract the tarball clobbers: the #test-utils import, the
// agent-eval devDependency, legacy-peer-deps, and a copy of vitest.config.ts
// under a name the harness won't overwrite at validation time.
//
// Ordering note: the manifest mutation deliberately lands *after*
// installDependencies(). The native install exists to reproduce the app's own
// lockfile-pinned tree (`pnpm install --frozen-lockfile` / vendored yarn), which
// a package.json carrying a dependency the lockfile has never seen would reject.
// The added @vercel/agent-eval devDependency is installed by the `npm install`
// every agent definition runs against the sandbox root right after setup().
export async function setupExternalRepo(sandbox: Sandbox): Promise<void> {
  const { repo, ref } = parseExternalRepoFromManifest(await sandbox.readFile('package.json'));
  const tarballUrl = `https://codeload.github.com/${repo}/tar.gz/${ref}`;

  // Download and extract as two steps rather than one `fetch | tar` pipe, so a
  // failure names which half broke. --strip-components=1 drops the tarball's
  // top-level <name>-<ref>/ dir.
  await runOrThrow(
    sandbox,
    'node',
    [
      '-e',
      NODE_DOWNLOAD_SCRIPT,
      tarballUrl,
      SANDBOX_TARBALL_PATH,
      String(FETCH_TIMEOUT_SECONDS * 1000),
    ],
    `download ${repo}@${ref}`
  );
  await runOrThrow(
    sandbox,
    'tar',
    ['xzf', SANDBOX_TARBALL_PATH, '--strip-components=1'],
    `extract ${repo}@${ref}`
  );
  // Best-effort: the tarball is ~20MB of dead weight in the sandbox image, but
  // a failure to remove it is not a reason to fail the run.
  await sandbox.runCommand('rm', ['-f', SANDBOX_TARBALL_PATH]);

  await installDependencies(sandbox);

  const appVitestConfig = await sandbox.readFile('vitest.config.ts').catch(() => null);

  const appManifest: unknown = JSON.parse(await sandbox.readFile('package.json'));
  if (!isRecord(appManifest)) {
    throw new Error(`setupExternalRepo: ${repo}@${ref} package.json is not a JSON object`);
  }
  // Ensures EVAL.ts subpath imports are defined in the fetched repo.
  appManifest.imports = {
    ...(isRecord(appManifest.imports) ? appManifest.imports : {}),
    '#test-utils': './__agent_eval__/test-utils.ts',
  };
  // Adds the agent eval dependency to the repo.
  appManifest.devDependencies = {
    ...(isRecord(appManifest.devDependencies) ? appManifest.devDependencies : {}),
    '@vercel/agent-eval': harnessVersion(),
  };

  // In some external repos (e.g. Mealdrop), there might be peer dependency
  // issues that we don't care about and that can cause the eval to fail
  // installing deps. Silently ignore them.
  const existingNpmrc = await sandbox.readFile('.npmrc').catch(() => '');
  const npmrc = [existingNpmrc.trim(), 'legacy-peer-deps=true'].filter(Boolean).join('\n') + '\n';

  await sandbox.writeFiles({
    'package.json': JSON.stringify(appManifest, null, '\t') + '\n',
    '.npmrc': npmrc,
    ...(appVitestConfig !== null ? { 'vitest.config.app.ts': appVitestConfig } : {}),
  });
}
