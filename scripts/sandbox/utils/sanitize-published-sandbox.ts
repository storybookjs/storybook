import { readFile, rm, writeFile } from 'node:fs/promises';

// eslint-disable-next-line depend/ban-dependencies
import { glob } from 'glob';
import yml from 'yaml';

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
