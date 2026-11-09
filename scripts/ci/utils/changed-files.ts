// A focused run's diff can name thousands of files, more than fits in one environment variable or
// argument (Linux caps each at 128 KiB). So a job hands on the commit the diff starts at, and each
// job or task that needs the files reads them from git.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Not from scripts/utils/constants.ts: main.ts imports this under plain Node, which rejects that
// module's `__dirname`.
const ROOT_DIRECTORY = fileURLToPath(new URL('../../..', import.meta.url));

const git = (args: string[], cwd: string, stderr: 'inherit' | 'ignore' = 'inherit') =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1024 ** 3,
    stdio: ['ignore', 'pipe', stderr],
  });

export const mergeBase = (baseRef: string, cwd = ROOT_DIRECTORY) =>
  git(['merge-base', baseRef, 'HEAD'], cwd).trim();

// The files changed between `base` and HEAD, as `git diff <base>...HEAD` lists them when `base` is
// the merge base. A shallow checkout fetches the commit first.
export function changedFilesSince(base: string, cwd = ROOT_DIRECTORY): string[] {
  try {
    git(['cat-file', '-e', `${base}^{commit}`], cwd, 'ignore');
  } catch {
    git(['fetch', '--depth=1', '--no-tags', 'origin', base], cwd);
  }
  return git(['diff', '--name-only', base, 'HEAD', '--'], cwd).split('\n').filter(Boolean);
}

export type FocusDiff = { base: string; files: string[] };

export function focusDiff(baseRef: string, cwd = ROOT_DIRECTORY): FocusDiff {
  const base = mergeBase(baseRef, cwd);
  return { base, files: changedFilesSince(base, cwd) };
}

// What `changedFilesFromEnvironment` reads. The count tells a diff that came out different from the
// one the run was planned from.
export const changedFilesEnvironment = (diff: FocusDiff | undefined) => ({
  CI_CHANGED_FILES_BASE: diff?.base ?? '',
  CI_CHANGED_FILES_COUNT: `${diff?.files.length ?? 0}`,
});

export function changedFilesFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
  cwd = ROOT_DIRECTORY
): string[] {
  const base = env.CI_CHANGED_FILES_BASE;
  const files = base ? changedFilesSince(base, cwd) : [];
  const expected = env.CI_CHANGED_FILES_COUNT;
  if (expected && Number(expected) !== files.length) {
    throw new Error(
      `${files.length} files changed since ${base || 'no commit'}, but the run was planned for ${expected}.`
    );
  }
  return files;
}
