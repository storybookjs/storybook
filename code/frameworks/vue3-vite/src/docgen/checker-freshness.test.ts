import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as memfs from 'memfs';
import { vol } from 'memfs';
import type { ComponentMetaChecker } from 'vue-component-meta';

import { CheckerFreshness } from './checker-freshness.ts';

vi.mock('node:fs', { spy: true });

function createChecker(fileNames: string[]) {
  const checker = {
    updateFile: vi.fn(),
    deleteFile: vi.fn(),
    getProgram: () => ({
      getSourceFiles: () => fileNames.map((fileName) => ({ fileName })),
    }),
  };
  return checker as unknown as ComponentMetaChecker & typeof checker;
}

/** memfs keeps mtime at second resolution unless it is set explicitly. */
const writeAt = (path: string, content: string, mtimeSeconds: number) => {
  vol.fromJSON({ [path]: content });
  vol.utimesSync(path, mtimeSeconds, mtimeSeconds);
};

beforeEach(async () => {
  vol.reset();
  const fs = await import('node:fs');
  vi.mocked(fs.statSync).mockImplementation(memfs.fs.statSync as typeof fs.statSync);
  vi.mocked(fs.readFileSync).mockImplementation(memfs.fs.readFileSync as typeof fs.readFileSync);
});

describe('CheckerFreshness', () => {
  it('does not touch the checker on the first sweep, when its snapshots are already current', () => {
    writeAt('/project/Button.vue', 'first', 1);
    const checker = createChecker(['/project/Button.vue']);

    new CheckerFreshness(checker).sweep();

    expect(checker.updateFile).not.toHaveBeenCalled();
  });

  it('re-reads a file whose mtime moved since the checker last saw it', () => {
    writeAt('/project/Button.vue', 'first', 1);
    const checker = createChecker(['/project/Button.vue']);
    const freshness = new CheckerFreshness(checker);
    freshness.sweep();

    writeAt('/project/Button.vue', 'second', 2);
    freshness.sweep();

    expect(checker.updateFile).toHaveBeenCalledWith('/project/Button.vue', 'second');

    // An unchanged file is not re-read again on the next sweep.
    checker.updateFile.mockClear();
    freshness.sweep();
    expect(checker.updateFile).not.toHaveBeenCalled();
  });

  it('drops a file that disappeared', () => {
    writeAt('/project/Button.vue', 'first', 1);
    const checker = createChecker(['/project/Button.vue']);
    const freshness = new CheckerFreshness(checker);
    freshness.sweep();

    vol.unlinkSync('/project/Button.vue');
    freshness.sweep();

    expect(checker.deleteFile).toHaveBeenCalledWith('/project/Button.vue');

    // Already deleted — a later sweep does not report it again.
    checker.deleteFile.mockClear();
    freshness.sweep();
    expect(checker.deleteFile).not.toHaveBeenCalled();
  });

  it('skips node_modules, which the engine never re-reads for docgen', () => {
    writeAt('/project/node_modules/dep/index.d.ts', 'first', 1);
    const checker = createChecker(['/project/node_modules/dep/index.d.ts']);
    const freshness = new CheckerFreshness(checker);
    freshness.sweep();

    writeAt('/project/node_modules/dep/index.d.ts', 'second', 2);
    freshness.sweep();

    expect(checker.updateFile).not.toHaveBeenCalled();
  });
});
