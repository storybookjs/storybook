import { describe, expect, it } from 'vitest';

import { isExcludedPath, isTestPath, SKIP_DIRS } from './paths.ts';

describe('isExcludedPath', () => {
  it('keeps application source', () => {
    expect(isExcludedPath('src/components/Button/Button.tsx')).toBe(false);
  });

  it('excludes harness scaffolding and the files it injects', () => {
    expect(isExcludedPath('PROMPT.md')).toBe(true);
    expect(isExcludedPath('__agent_eval__/test-utils.ts')).toBe(true);
    expect(isExcludedPath('pnpm-lock.yaml')).toBe(true);
  });

  it('excludes generated bundles by name', () => {
    expect(isExcludedPath('src/vendor.min.js')).toBe(true);
    expect(isExcludedPath('public/mockServiceWorker.js')).toBe(true);
  });

  // Every walker in this repo refuses to descend into these, so a path-based
  // filter has to agree with them. The one consumer whose paths come from
  // somewhere else — the judge's diff, walked by git — otherwise sees a whole
  // build/ directory as authored source.
  it('excludes anything under a directory never worth walking', () => {
    for (const dir of SKIP_DIRS) {
      expect(isExcludedPath(`${dir}/index.js`)).toBe(true);
    }
    expect(isExcludedPath('build/assets/index-kRzogI1m.js')).toBe(true);
    expect(isExcludedPath('packages/ui/node_modules/left-pad/index.js')).toBe(true);
  });

  // The rule reads directory segments only: a source file may be named after
  // one, and the walkers would still hand it over.
  it('keeps a file whose own name matches a skipped directory', () => {
    expect(isExcludedPath('src/build.ts')).toBe(false);
  });
});

describe('isTestPath', () => {
  it('recognises test and spec files by their name', () => {
    expect(isTestPath('src/components/Header/Header.test.tsx')).toBe(true);
    expect(isTestPath('src/a.spec.ts')).toBe(true);
  });

  it('recognises files under a __tests__ directory', () => {
    expect(isTestPath('src/__tests__/Header.tsx')).toBe(true);
  });

  it('keeps production files, even ones with test in their name', () => {
    expect(isTestPath('src/components/Header/Header.tsx')).toBe(false);
    expect(isTestPath('src/latest.ts')).toBe(false);
    expect(isTestPath('src/testimonials/Card.tsx')).toBe(false);
  });

  // Stories are demo markup, not test code: they stay measured.
  it('keeps story files', () => {
    expect(isTestPath('src/components/Header/Header.stories.tsx')).toBe(false);
  });
});
