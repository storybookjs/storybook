import { readFile, rm, writeFile } from 'node:fs/promises';

// eslint-disable-next-line depend/ban-dependencies
import { execa } from 'execa';
// eslint-disable-next-line depend/ban-dependencies
import { glob } from 'glob';
import { basename, dirname, join } from 'pathe';

/**
 * Git ignore rules the published sandboxes repository must end up with, in this order.
 *
 * The repository ignores lockfiles wholesale, and `commitAllToGit` stages with `git add .`, so
 * without the negation the generated `before-storybook` lockfile is silently dropped and consumers
 * still resolve whatever is newest at install time.
 *
 * `after-storybook` deliberately stays ignored: it resolves Storybook packages from the local
 * registry, and in link mode its lockfile carries `file:` resolutions pointing back into the
 * monorepo, neither of which a consumer can install from.
 */
export const GITIGNORE_LOCKFILE_RULES = [
  'yarn.lock',
  'pnpm-lock.yaml',
  '!**/before-storybook/pnpm-lock.yaml',
] as const;

const MANAGED_BLOCK_HEADER =
  '# Managed by publish-sandboxes: publish only the before-storybook lockfile';

/**
 * Make sure the published tree ships the `before-storybook` lockfile and nothing else lock-shaped.
 *
 * Replaces the managed block, the header and the lines up to the next blank line, and writes it at
 * the end, because git ignore precedence is last-match-wins: the end guarantees the intended
 * outcome regardless of what the repository's own `.gitignore` already says.
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

  const lines = contents.split('\n');
  const start = lines.findIndex((line) => line.trim() === MANAGED_BLOCK_HEADER);
  if (start !== -1) {
    let end = start + 1;
    while (end < lines.length && lines[end].trim() !== '') {
      end++;
    }
    // Also drop the blank line that separated the block, so no gap is left behind.
    if (start === 0 || lines[start - 1].trim() === '') {
      end++;
    }
    lines.splice(start, end - start);
  }

  const rest = lines.join('\n').trimEnd();
  const updated = `${rest ? `${rest}\n\n` : ''}${MANAGED_BLOCK_HEADER}\n${GITIGNORE_LOCKFILE_RULES.join('\n')}\n`;
  if (updated === contents) {
    return false;
  }

  await writeFile(gitignorePath, updated);
  return true;
};

/**
 * Paths excluded from the published sandbox copy. These are install artifacts or build outputs
 * that bloat the repo without providing value to consumers (who will install again from the
 * committed lockfile).
 */
export const EXCLUDE_GLOBS = [
  '**/.yarn/cache/**',
  '**/.yarn/install-state.gz',
  '**/.yarn/build-state.yml',
  '**/.yarn/unplugged/**',
  '**/node_modules/**',
  '**/.cache/**',
  '**/storybook-static/**',
] as const;

export type SanitizeResult = {
  removedPaths: number;
};

/** Remove the paths matching `EXCLUDE_GLOBS` from a tree about to be published. */
export const sanitizePublishedSandboxes = async (rootDir: string): Promise<SanitizeResult> => {
  const excluded = await glob([...EXCLUDE_GLOBS], {
    cwd: rootDir,
    absolute: true,
    dot: true,
  });

  for (const target of excluded) {
    await rm(target, { recursive: true, force: true });
  }

  return {
    removedPaths: excluded.length,
  };
};

const LOCAL_REGISTRY_HOSTS = [
  'localhost:6001',
  'localhost:6002',
  '127.0.0.1:6001',
  '127.0.0.1:6002',
];

const git = (rootDir: string, args: string[]) =>
  execa('git', args, { cwd: rootDir, reject: false });

/**
 * Check what `git add .` staged for the templates this run publishes, before it is committed:
 *
 * - every `before-storybook/pnpm-lock.yaml` is tracked;
 * - no tracked file points at the local registry;
 * - no `before-storybook` lockfile carries `tarball:` URLs, which would pin a registry;
 * - no folder tracks both a Yarn and a pnpm lockfile.
 */
export const assertPublishedTree = async (rootDir: string, templates: string[]) => {
  if (!templates.length) {
    return;
  }

  const listed = await git(rootDir, ['ls-files', '-z', '--', ...templates]);
  if (listed.exitCode !== 0) {
    throw new Error(`git ls-files failed: ${listed.stderr}`);
  }
  const tracked = new Set(String(listed.stdout).split('\0').filter(Boolean));
  const problems: string[] = [];

  for (const template of templates) {
    const lockfile = `${template}/before-storybook/pnpm-lock.yaml`;
    const contents = await readFile(join(rootDir, lockfile), 'utf-8').catch(() => undefined);
    if (contents === undefined) {
      continue;
    }
    if (!tracked.has(lockfile)) {
      problems.push(`${lockfile} is not tracked`);
    } else if (contents.includes('tarball:')) {
      problems.push(`${lockfile} has tarball URLs`);
    }
  }

  const leaks = await git(rootDir, [
    'grep',
    '--cached',
    '-I',
    '-l',
    '-F',
    ...LOCAL_REGISTRY_HOSTS.flatMap((host) => ['-e', host]),
    '--',
    ...templates,
  ]);
  if (leaks.exitCode === 0) {
    problems.push(
      ...String(leaks.stdout)
        .split('\n')
        .filter(Boolean)
        .map((file) => `${file} points at the local registry`)
    );
  } else if (leaks.exitCode !== 1) {
    throw new Error(`git grep failed: ${leaks.stderr}`);
  }

  const lockfileDirs = [...tracked]
    .filter((file) => ['yarn.lock', 'pnpm-lock.yaml'].includes(basename(file)))
    .map((file) => dirname(file));
  for (const dir of new Set(lockfileDirs.filter((dir, i) => lockfileDirs.indexOf(dir) !== i))) {
    problems.push(`${dir} tracks both yarn.lock and pnpm-lock.yaml`);
  }

  if (problems.length) {
    throw new Error(`Refusing to publish the sandboxes:\n${problems.join('\n')}`);
  }
};
