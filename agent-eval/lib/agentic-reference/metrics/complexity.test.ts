import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { complexityForTree, complexityForFiles, sumComplexities } from './complexity.ts';

import type { FileComplexity } from './complexity.ts';

let root: string;

function writeTree(name: string, files: Record<string, string>): string {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

/** A full FileComplexity with unmentioned measures at zero. */
function score(partial: Partial<FileComplexity>): FileComplexity {
  return {
    cyclomatic: 0,
    cognitive: 0,
    jsxCyclomatic: 0,
    jsxCognitive: 0,
    jsxLength: 0,
    jsxBindings: 0,
    jsxDepthTotal: 0,
    jsxTrees: 0,
    ...partial,
  };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'baseline-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('complexityForFiles', () => {
  it('scores each of the given files', () => {
    const dir = writeTree('src', {
      'a.ts': 'function a(x){ if (x) return 1; return 0; }\n',
      'b.ts': 'function b(){ return 1; }\n',
    });
    expect(complexityForFiles(dir, ['a.ts', 'b.ts'])).toEqual({
      files: {
        'a.ts': score({ cyclomatic: 2, cognitive: 1, jsxCyclomatic: 2, jsxCognitive: 1 }),
        'b.ts': score({ cyclomatic: 1, jsxCyclomatic: 1 }),
      },
      parseFailures: [],
    });
  });

  it('carries every jsx measure for a markup file', () => {
    const dir = writeTree('src', {
      'c.tsx': 'export const C = () => <div><span>hi</span></div>;\n',
    });
    expect(complexityForFiles(dir, ['c.tsx'])).toEqual({
      files: {
        // classic: one trivial function. jsxCognitive prices the structural
        // div; jsx-structure carries the two tags and the depth-2 tree.
        'c.tsx': score({
          cyclomatic: 1,
          jsxCyclomatic: 1,
          jsxCognitive: 1,
          jsxLength: 2,
          jsxDepthTotal: 2,
          jsxTrees: 1,
        }),
      },
      parseFailures: [],
    });
  });

  it('skips a missing file without failing', () => {
    const dir = writeTree('src', { 'a.ts': 'function a(){ return 1; }\n' });
    expect(complexityForFiles(dir, ['a.ts', 'gone.ts'])).toEqual({
      files: { 'a.ts': score({ cyclomatic: 1, jsxCyclomatic: 1 }) },
      parseFailures: [],
    });
  });

  it('records a file it cannot parse rather than scoring it zero', () => {
    const dir = writeTree('src', { 'broken.ts': 'function ( { { {\n' });
    expect(complexityForFiles(dir, ['broken.ts'])).toEqual({
      files: {},
      parseFailures: ['broken.ts'],
    });
  });

  it('ignores non-script files', () => {
    const dir = writeTree('src', { 'a.css': '.a { color: red; }\n' });
    expect(complexityForFiles(dir, ['a.css'])).toEqual({ files: {}, parseFailures: [] });
  });
});

describe('complexityForTree', () => {
  it('scores every script file in the tree', () => {
    const dir = writeTree('ref', {
      'src/a.ts': 'function a(x){ if (x) return 1; return 0; }\n',
      'src/nested/b.ts': 'function b(){ return 1; }\n',
    });
    expect(complexityForTree(dir)).toEqual({
      files: {
        'src/a.ts': score({ cyclomatic: 2, cognitive: 1, jsxCyclomatic: 2, jsxCognitive: 1 }),
        'src/nested/b.ts': score({ cyclomatic: 1, jsxCyclomatic: 1 }),
      },
      parseFailures: [],
    });
  });

  it('skips files that carry no complexity measure', () => {
    const dir = writeTree('ref', {
      'src/a.ts': 'function a(){ return 1; }\n',
      'README.md': '# ignored\n',
      'src/a.css': '.a { color: red; }\n',
    });
    expect(Object.keys(complexityForTree(dir).files)).toEqual(['src/a.ts']);
  });

  it('reports an unparseable file rather than recording it as zero', () => {
    const dir = writeTree('ref', {
      'src/ok.ts': 'function a(){ return 1; }\n',
      'src/broken.ts': 'function ( { { {\n',
    });
    expect(complexityForTree(dir)).toEqual({
      files: { 'src/ok.ts': score({ cyclomatic: 1, jsxCyclomatic: 1 }) },
      parseFailures: ['src/broken.ts'],
    });
  });

  it('emits sorted keys, so a committed baseline diffs cleanly when a pin moves', () => {
    const dir = writeTree('ref', {
      'src/z.ts': 'function z(){ return 1; }\n',
      'src/a.ts': 'function a(){ return 1; }\n',
      'src/m.ts': 'function m(){ return 1; }\n',
    });
    expect(Object.keys(complexityForTree(dir).files)).toEqual(['src/a.ts', 'src/m.ts', 'src/z.ts']);
  });

  it('returns nothing for a tree that is not there', () => {
    expect(complexityForTree(join(root, 'no-such-dir'))).toEqual({
      files: {},
      parseFailures: [],
    });
  });
});

describe('sumComplexities', () => {
  it('totals every measure across scored files', () => {
    expect(
      sumComplexities({
        'a.ts': score({ cyclomatic: 2, cognitive: 1, jsxCyclomatic: 2, jsxCognitive: 1 }),
        'b.ts': score({ cyclomatic: 1, jsxCyclomatic: 1 }),
        'c.tsx': score({
          cyclomatic: 4,
          cognitive: 7,
          jsxCyclomatic: 6,
          jsxCognitive: 12,
          jsxLength: 9,
          jsxBindings: 5,
          jsxDepthTotal: 7,
          jsxTrees: 2,
        }),
      })
    ).toEqual(
      score({
        cyclomatic: 7,
        cognitive: 8,
        jsxCyclomatic: 9,
        jsxCognitive: 13,
        jsxLength: 9,
        jsxBindings: 5,
        jsxDepthTotal: 7,
        jsxTrees: 2,
      })
    );
  });

  it('totals a whole tree, so a baseline can be folded without rescoring it', () => {
    const dir = writeTree('ref', {
      'src/a.ts': 'function a(x){ if (x) return 1; return 0; }\n',
      'src/b.ts': 'function b(){ return 1; }\n',
    });
    expect(sumComplexities(complexityForTree(dir).files)).toEqual(
      score({ cyclomatic: 3, cognitive: 1, jsxCyclomatic: 3, jsxCognitive: 1 })
    );
  });

  it('is zero for no files, rather than undefined', () => {
    expect(sumComplexities({})).toEqual(score({}));
  });
});
