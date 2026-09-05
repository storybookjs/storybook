import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { treePatch } from './tree-patch.ts';

let root: string;

function tree(name: string, files: Record<string, string>): string {
  const dir = join(root, name);
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), contents);
  }
  mkdirSync(dir, { recursive: true });
  return dir;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'tree-patch-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('treePatch', () => {
  it('reports no change between identical trees', () => {
    const files = { 'src/App.tsx': 'export const App = () => <div />\n' };
    const patch = treePatch(tree('before', files), tree('after', files));
    expect(patch).toEqual({
      text: '',
      files: [],
      beforePaths: [],
      truncated: false,
      droppedFiles: 0,
    });
  });

  // Without rewriting, every header names two absolute cache directories and
  // the judge cannot tell which repo file it is looking at.
  it('rewrites both tree roots to workspace-relative paths', () => {
    const patch = treePatch(
      tree('before', { 'src/App.tsx': 'const a = 1\n' }),
      tree('after', { 'src/App.tsx': 'const a = 2\n' })
    );
    expect(patch.files).toEqual(['src/App.tsx']);
    expect(patch.text).toContain('diff --git a/src/App.tsx b/src/App.tsx');
    expect(patch.text).toContain('--- a/src/App.tsx');
    expect(patch.text).toContain('+++ b/src/App.tsx');
    expect(patch.text).not.toContain(root);
    // git prints the roots with their leading slash stripped, so the raw path
    // has to be gone under that spelling too, not just the absolute one.
    expect(patch.text).not.toContain(root.replace(/^\/+/, ''));
  });

  // The before-census filter (index.ts) keys off beforePaths, so a modified
  // file — the ordinary case — has to show up on both lists.
  it('puts a modified file in both files and beforePaths', () => {
    const patch = treePatch(
      tree('before', { 'src/App.tsx': 'const a = 1\n' }),
      tree('after', { 'src/App.tsx': 'const a = 2\n' })
    );
    expect(patch.files).toEqual(['src/App.tsx']);
    expect(patch.beforePaths).toEqual(['src/App.tsx']);
  });

  // git diff --no-index has no index entry to say "this file is gone" — a
  // deletion is a block whose "after" name is only ever /dev/null in the body,
  // but whose header still needs a b/ path to pair with a/, so git reuses the
  // a/ name for both header slots. beforePaths must still pick it up: a
  // deleted file is exactly the kind of before-only evidence move-matching
  // needs to see.
  it('puts a deleted file in beforePaths (and, per the header git writes, in files too)', () => {
    const patch = treePatch(
      tree('before', {
        'src/App.tsx': 'const a = 1\n',
        'src/Deleted.tsx': 'export const gone = 1\n',
      }),
      tree('after', { 'src/App.tsx': 'const a = 1\n' })
    );
    expect(patch.text).toContain('deleted file mode');
    expect(patch.beforePaths).toEqual(['src/Deleted.tsx']);
    expect(patch.files).toEqual(['src/Deleted.tsx']);
  });

  // git diff --no-index pairs a deletion with a similar-enough-content addition
  // into one rename block by default (no --no-renames or --find-renames is
  // passed, so the built-in 50% threshold applies) rather than emitting them
  // as separate delete/add blocks. That single block's header names both
  // images, so this is the case beforePaths and files genuinely diverge on:
  // the old path is the move's evidence, the new path is where the treatment
  // census must look.
  it('splits a renamed file into its pre- and post-image paths', () => {
    const patch = treePatch(
      tree('before', {
        'src/Old.tsx': [
          'export const Old = () => <div>',
          '  <p>hello</p>',
          '  <p>world</p>',
          '  <p>more filler text to pad it out</p>',
          '</div>\n',
        ].join('\n'),
      }),
      tree('after', {
        'src/moved/New.tsx': [
          'export const Old = () => <div>',
          '  <p>hello</p>',
          '  <p>world</p>',
          '  <p>more filler text CHANGED to pad it out</p>',
          '</div>\n',
        ].join('\n'),
      })
    );
    // The `diff --git a/x b/y` header is what pathsOfBlock actually reads,
    // and it strips cleanly because both sides carry the a/ or b/ prefix.
    expect(patch.text).toContain('diff --git a/src/Old.tsx b/src/moved/New.tsx');
    expect(patch.text).toContain('--- a/src/Old.tsx');
    expect(patch.text).toContain('+++ b/src/moved/New.tsx');
    expect(patch.files).toEqual(['src/moved/New.tsx']);
    expect(patch.beforePaths).toEqual(['src/Old.tsx']);
  });

  it('includes files added by the run', () => {
    const patch = treePatch(
      tree('before', { 'src/App.tsx': 'const a = 1\n' }),
      tree('after', { 'src/App.tsx': 'const a = 1\n', 'src/New.tsx': 'export const New = 1\n' })
    );
    expect(patch.files).toEqual(['src/New.tsx']);
    expect(patch.text).toContain('new file mode');
    expect(patch.text).toContain('+export const New = 1');
  });

  // The metric is about source the agent wrote. Lockfiles and harness scaffolding
  // are neither, and a lockfile alone can blow the whole byte budget.
  it('drops non-source and excluded paths', () => {
    const patch = treePatch(
      tree('before', { 'src/App.tsx': 'const a = 1\n' }),
      tree('after', {
        'src/App.tsx': 'const a = 2\n',
        'pnpm-lock.yaml': 'lockfileVersion: 9\n',
        'notes.md': 'hello\n',
        '__agent_eval__/test-utils.ts': 'export const x = 1\n',
      })
    );
    expect(patch.files).toEqual(['src/App.tsx']);
  });

  // The eval builds the app, so a collected tree carries a `build/` the pinned
  // tree never had. Those bundles are .js and .css, which the extension filter
  // alone lets through — and one minified chunk is larger than the entire byte
  // budget, so the cap then drops the handful of source lines the judge was
  // called to read and reports the diff as truncated.
  it('drops output from directories no walker descends into', () => {
    const patch = treePatch(
      tree('before', { 'src/App.tsx': 'const a = 1\n' }),
      tree('after', {
        'src/App.tsx': 'const a = 2\n',
        'build/assets/index-kRzogI1m.js': 'var a=1;\n',
        'build/assets/index-CLHgnaiz.css': '.a{color:red}\n',
        'dist/bundle.js': 'var b=2\n',
        'coverage/lcov-report/block-navigation.js': 'var c=3\n',
        'node_modules/left-pad/index.js': 'var d=4\n',
      })
    );
    expect(patch.files).toEqual(['src/App.tsx']);
  });

  it('cuts at a file boundary when over the cap and says how many it dropped', () => {
    const big = 'x'.repeat(4000) + '\n';
    const patch = treePatch(
      tree('before', { 'src/A.tsx': 'const a = 1\n', 'src/B.tsx': 'const b = 1\n' }),
      tree('after', { 'src/A.tsx': big, 'src/B.tsx': big }),
      { maxBytes: 2000 }
    );
    expect(patch.truncated).toBe(true);
    expect(patch.droppedFiles).toBeGreaterThan(0);
    // Whole blocks only — a half-written hunk would read as a real edit.
    expect(patch.text.split('diff --git').length - 1).toBe(patch.files.length);
  });

  // git exits 1 for a path it cannot access exactly as it does for a difference,
  // so an unguarded missing tree reads as "the run changed nothing" — a run that
  // never got copied out would be judged as having written nothing at all.
  it('throws when a tree is missing rather than reporting no change', () => {
    const after = tree('after', { 'src/App.tsx': 'const a = 1\n' });
    expect(() => treePatch(join(root, 'absent'), after)).toThrow(/tree not found/);
    expect(() => treePatch(after, join(root, 'absent'))).toThrow(/tree not found/);
  });

  // The cap dropping everything proves nothing about the boundary: the case that
  // matters is a cut that keeps one block and drops the next, whole.
  it('keeps whole blocks that fit and drops the ones that do not', () => {
    const big = 'x'.repeat(4000) + '\n';
    const patch = treePatch(
      tree('before', { 'src/A.tsx': 'const a = 1\n', 'src/B.tsx': 'const b = 1\n' }),
      tree('after', { 'src/A.tsx': 'const a = 2\n', 'src/B.tsx': big }),
      { maxBytes: 500 }
    );
    expect(patch.files).toEqual(['src/A.tsx']);
    expect(patch.droppedFiles).toBe(1);
    expect(patch.truncated).toBe(true);
    expect(patch.text).toContain('+const a = 2');
    expect(patch.text).not.toContain('src/B.tsx');
    expect(patch.text.split('diff --git').length - 1).toBe(1);
  });
});
