import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import {
  findCompodocScanRoot,
  isDocumentationFresh,
  newestSourceMtimeMs,
} from './documentation-freshness.ts';

vi.mock('node:fs', { spy: true });

beforeEach(async () => {
  vol.reset();
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(existsSync).mockImplementation(memfs.fs.existsSync as typeof existsSync);
  vi.mocked(readdirSync).mockImplementation(memfs.fs.readdirSync as typeof readdirSync);
  vi.mocked(statSync).mockImplementation(memfs.fs.statSync as typeof statSync);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const ROOT = resolve('/workspace');
const at = (...segments: string[]) => resolve(ROOT, ...segments);

const touch = (path: string, atMs: number) => vol.utimesSync(path, new Date(atMs), new Date(atMs));

describe('findCompodocScanRoot', () => {
  // Compodoc globs from the directory holding the tsconfig it was given ("use the current directory
  // of tsconfig.json as a working directory"), so that directory - not the nearest package.json - is
  // the outer bound of what a run could have read.
  it('is the directory holding the tsconfig, which is what Compodoc globs from', () => {
    expect(findCompodocScanRoot(at('projects/lib/tsconfig.doc.json'))).toBe(at('projects/lib'));
    expect(findCompodocScanRoot(at('tsconfig.json'))).toBe(ROOT);
  });

  it('does not widen to the workspace root for a project that has no package.json of its own', () => {
    // The Nx/Angular-library layout: `projects/lib` carries no package.json. Widening here would let
    // an edit anywhere else in the monorepo force a rescan of this project.
    expect(findCompodocScanRoot(at('projects/lib/tsconfig.lib.json'))).not.toBe(ROOT);
  });
});

describe('newestSourceMtimeMs', () => {
  it('counts the sources Compodoc reads and ignores the ones it excludes', () => {
    // Mirrors Compodoc's own INCLUDE_PATTERNS/EXCLUDE_PATTERNS. Counting `.d.ts` or `.spec.ts` would
    // force a full rescan after an ordinary build or test edit; missing `.tsx` would leave a new
    // component undocumented until something else changed.
    vol.fromNestedJSON({
      [at('src/old.component.ts')]: '',
      [at('src/new.component.ts')]: '',
      [at('src/widget.component.tsx')]: '',
      [at('src/button.component.html')]: '',
      [at('src/button.component.spec.ts')]: '',
      [at('src/generated.d.ts')]: '',
    });
    touch(at('src/old.component.ts'), 1000);
    touch(at('src/new.component.ts'), 5000);
    touch(at('src/widget.component.tsx'), 6000);
    touch(at('src/button.component.html'), 9000);
    touch(at('src/button.component.spec.ts'), 9000);
    touch(at('src/generated.d.ts'), 9000);

    expect(newestSourceMtimeMs(ROOT)).toBe(6000);
  });

  it('skips node_modules and any directory the caller excludes', () => {
    vol.fromNestedJSON({
      [at('src/button.component.ts')]: '',
      [at('node_modules/some-package/index.ts')]: '',
      [at('dist/docs/generated.ts')]: '',
    });
    touch(at('src/button.component.ts'), 1000);
    touch(at('node_modules/some-package/index.ts'), 9000);
    touch(at('dist/docs/generated.ts'), 9000);

    expect(newestSourceMtimeMs(ROOT, [at('dist/docs')])).toBe(1000);
  });

  it('reports nothing for a tree with no TypeScript in it', () => {
    vol.fromNestedJSON({ [at('src/styles.scss')]: '' });

    expect(newestSourceMtimeMs(ROOT)).toBeUndefined();
  });
});

describe('isDocumentationFresh', () => {
  const documentationJson = at('dist/docs/documentation.json');

  const givenTree = ({ generatedAt }: { generatedAt?: number }) => {
    vol.fromNestedJSON({
      [at('src/button.component.ts')]: '',
      ...(generatedAt === undefined ? {} : { [documentationJson]: '{}' }),
    });
    touch(at('src/button.component.ts'), 3000);
    if (generatedAt !== undefined) {
      touch(documentationJson, generatedAt);
    }
  };

  it('serves a file generated after the newest source', () => {
    givenTree({ generatedAt: 4000 });

    expect(isDocumentationFresh(documentationJson, ROOT, [at('dist/docs')])).toBe(true);
  });

  it('regenerates when a source was touched after the file was written', () => {
    givenTree({ generatedAt: 2000 });

    expect(isDocumentationFresh(documentationJson, ROOT, [at('dist/docs')])).toBe(false);
  });

  it('regenerates when the file is missing', () => {
    givenTree({});

    expect(isDocumentationFresh(documentationJson, ROOT, [at('dist/docs')])).toBe(false);
  });

  it('regenerates when the file is empty, which is what a torn write looks like', () => {
    givenTree({ generatedAt: 4000 });
    vol.writeFileSync(documentationJson, '');
    touch(documentationJson, 4000);

    expect(isDocumentationFresh(documentationJson, ROOT, [at('dist/docs')])).toBe(false);
  });

  it('serves whatever exists when there are no sources to be stale against', () => {
    vol.fromNestedJSON({ [documentationJson]: '{}' });

    expect(isDocumentationFresh(documentationJson, ROOT, [at('dist/docs')])).toBe(true);
  });
});
