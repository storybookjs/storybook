import { cp, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** A prebuilt runtime owned by a lower package, re-served from this package's `dist`. */
export interface RuntimeCopy {
  /** Directory of the owning package's build output, relative to `code/`. */
  from: string;
  /** Destination directory, relative to this package. */
  to: string;
  /** Entries of `from` to copy; a missing one fails the build. */
  files: string[];
}

export const RUNTIME_COPIES: RuntimeCopy[] = [
  // Deprecated until Storybook 12: builders locate it with `getMockerRuntimePath()` instead.
  {
    from: 'core/dist/test/mocking',
    to: 'dist/core/test/mocking',
    files: ['mocker-runtime.js'],
  },
];

/**
 * An `exports` target cannot point outside its package and the browser loads these files by path,
 * so a re-export shim cannot stand in for them.
 */
export async function copyRuntimes(
  cwd: string,
  codeDir: string,
  copies: RuntimeCopy[] = RUNTIME_COPIES
): Promise<void> {
  for (const { from, to, files } of copies) {
    const available = new Set(await readdir(join(codeDir, from)));
    await mkdir(join(cwd, to), { recursive: true });
    for (const name of files) {
      if (!available.has(name)) {
        throw new Error(`Runtime "${name}" is missing from ${join(codeDir, from)}`);
      }
      await cp(join(codeDir, from, name), join(cwd, to, name), { recursive: true });
    }
  }
}
