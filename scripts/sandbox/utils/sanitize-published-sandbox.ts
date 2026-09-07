import { readFile, rm, writeFile } from 'node:fs/promises';

import { join } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import { glob } from 'glob';
import yml from 'yaml';

/**
 * Git ignore rules the published sandboxes repository must end up with, in this order.
 *
 * The repository ignores `yarn.lock` wholesale, and `commitAllToGit` stages with `git add .`, so
 * without the negation the generated `before-storybook` lockfile is silently dropped and consumers
 * still resolve whatever is newest at install time.
 *
 * `after-storybook` deliberately stays ignored: it resolves Storybook packages from the local
 * registry, and in link mode its lockfile carries `portal:`/`file:` resolutions pointing back into
 * the monorepo, neither of which a consumer can install from.
 */
export const GITIGNORE_LOCKFILE_RULES = ['yarn.lock', '!**/before-storybook/yarn.lock'] as const;

const MANAGED_BLOCK_HEADER =
  '# Managed by publish-sandboxes: publish only the before-storybook lockfile';

/**
 * Make sure the published tree ships the `before-storybook` lockfile and nothing else lock-shaped.
 *
 * Appends the rules rather than editing existing lines, because git ignore precedence is
 * last-match-wins: appending guarantees the intended outcome regardless of what the repository's
 * own `.gitignore` already says.
 */
export const ensureLockfilePublishRules = async (rootDir: string): Promise<boolean> => {
  const gitignorePath = join(rootDir, '.gitignore');

  let contents = '';
  try {
    contents = await readFile(gitignorePath, 'utf-8');
  } catch {
    // No .gitignore in the sandboxes repo: still write the rules, so the after-storybook
    // lockfile does not start getting published by omission.
  }

  const lines = contents.split('\n').map((line) => line.trim());
  if (GITIGNORE_LOCKFILE_RULES.every((rule) => lines.includes(rule))) {
    return false;
  }

  const prefix = contents.length > 0 && !contents.endsWith('\n') ? '\n' : '';
  await writeFile(
    gitignorePath,
    `${contents}${prefix}\n${MANAGED_BLOCK_HEADER}\n${GITIGNORE_LOCKFILE_RULES.join('\n')}\n`
  );

  return true;
};

/**
 * Keys stripped from `after-storybook/.yarnrc.yml` before publishing to the public sandboxes
 * repository. These are host-local or Verdaccio-bootstrap settings that would either break a
 * consumer's install (e.g. `npmRegistryServer: http://localhost:6001/`) or weaken their default
 * supply-chain protections (e.g. `npmMinimalAgeGate: 0`).
 *
 * Mutating this list requires a deliberate code review (the integrity test asserts the exact set).
 */
export const STRIP_KEYS = [
  'npmRegistryServer',
  'unsafeHttpWhitelist',
  'enableImmutableInstalls',
  'enableMirror',
  'logFilters',
  'npmMinimalAgeGate',
  // `after-storybook` is a copy of `before-storybook`, so it inherits the
  // prerelease allowlist. Left behind next to a stripped gate it is dead
  // config, and it would quietly widen a consumer's own gate.
  'npmPreapprovedPackages',
  'pnpFallbackMode',
  'enableGlobalCache',
  'checksumBehavior',
] as const;

/**
 * Paths excluded from the published sandbox copy. These are install artifacts or build outputs
 * that bloat the repo without providing value to consumers (who will re-run `yarn install` against
 * the committed lockfile).
 */
export const EXCLUDE_GLOBS = [
  '**/.yarn/cache/**',
  '**/.yarn/install-state.gz',
  '**/.yarn/build-state.yml',
  '**/.yarn/unplugged/**',
  '**/.pnp.cjs',
  '**/.pnp.loader.mjs',
  '**/node_modules/**',
  '**/.cache/**',
  '**/storybook-static/**',
] as const;

export type SanitizeResult = {
  filteredYarnrcCount: number;
  strippedKeyCount: number;
  removedPaths: number;
};

/**
 * Sanitize a directory tree that is about to be published to `storybookjs/sandboxes`.
 *
 * - Removes `STRIP_KEYS` from every `**\/after-storybook/.yarnrc.yml` (verdaccio/host config).
 * - Removes paths matching `EXCLUDE_GLOBS` from the tree (install artifacts, build output).
 *
 * `before-storybook/.yarnrc.yml` is intentionally left untouched: it contains only the
 * user-facing Yarn setup we want consumers to reproduce.
 */
export const sanitizePublishedSandboxes = async (rootDir: string): Promise<SanitizeResult> => {
  const yarnrcFiles = await glob('**/after-storybook/.yarnrc.yml', {
    cwd: rootDir,
    absolute: true,
    dot: true,
  });

  let filteredYarnrcCount = 0;
  let strippedKeyCount = 0;

  for (const file of yarnrcFiles) {
    const original = await readFile(file, 'utf-8');
    if (!original.trim()) {
      continue;
    }

    const doc = (yml.parse(original) ?? {}) as Record<string, unknown>;
    let modified = false;

    for (const key of STRIP_KEYS) {
      if (key in doc) {
        delete doc[key];
        modified = true;
        strippedKeyCount++;
      }
    }

    if (modified) {
      const updated = Object.keys(doc).length === 0 ? '' : yml.stringify(doc);
      await writeFile(file, updated);
      filteredYarnrcCount++;
    }
  }

  const excluded = await glob([...EXCLUDE_GLOBS], {
    cwd: rootDir,
    absolute: true,
    dot: true,
  });

  for (const target of excluded) {
    await rm(target, { recursive: true, force: true });
  }

  return {
    filteredYarnrcCount,
    strippedKeyCount,
    removedPaths: excluded.length,
  };
};
