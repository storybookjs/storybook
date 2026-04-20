import { describe, expect, it } from 'vitest';

import {
  diffAddsTokenInStoryFiles,
  filterStorybookFiles,
  computeQualityScore,
  countTypeCheckErrors,
  parseChangedFiles,
} from './grade.ts';
import type { FileChange } from './grade.ts';

describe('filterStorybookFiles', () => {
  it('matches files in .storybook/ directory', () => {
    const files: FileChange[] = [
      { path: '.storybook/main.ts', gitStatus: 'M' },
      { path: '.storybook/preview.tsx', gitStatus: 'A' },
      { path: 'src/App.tsx', gitStatus: 'M' },
    ];
    expect(filterStorybookFiles(files)).toMatchObject([
      { path: '.storybook/main.ts', gitStatus: 'M' },
      { path: '.storybook/preview.tsx', gitStatus: 'A' },
    ]);
  });

  it('matches story files with various extensions', () => {
    const files: FileChange[] = [
      { path: 'src/Button.stories.tsx', gitStatus: 'A' },
      { path: 'src/Header.stories.ts', gitStatus: 'A' },
      { path: 'src/Page.story.jsx', gitStatus: 'A' },
      { path: 'src/utils.stories.js', gitStatus: 'A' },
      { path: 'src/Button.tsx', gitStatus: 'M' },
      { path: 'src/Button.test.tsx', gitStatus: 'M' },
    ];
    expect(filterStorybookFiles(files)).toMatchObject(files.slice(0, 4));
  });

  it('returns empty for no storybook files', () => {
    const files: FileChange[] = [
      { path: 'src/App.tsx', gitStatus: 'M' },
      { path: 'package.json', gitStatus: 'M' },
    ];
    expect(filterStorybookFiles(files)).toHaveLength(0);
  });

  it('handles empty input', () => {
    expect(filterStorybookFiles([])).toHaveLength(0);
  });

  it('matches renamed files using either side of the rename', () => {
    const files: FileChange[] = [
      { path: 'src/Button.tsx', previousPath: 'src/Button.stories.tsx', gitStatus: 'R' },
      { path: '.storybook/preview.tsx', previousPath: 'config/preview.tsx', gitStatus: 'R' },
      { path: 'src/App.tsx', previousPath: 'src/Main.tsx', gitStatus: 'R' },
    ];

    expect(filterStorybookFiles(files)).toMatchObject(files.slice(0, 2));
  });
});

describe('diffAddsTokenInStoryFiles', () => {
  const storyChanges: FileChange[] = [
    { path: 'src/Button.stories.tsx', gitStatus: 'A' },
    { path: '.storybook/preview.tsx', gitStatus: 'M' },
  ];

  it('returns true when the token is added inside a story file', () => {
    const diff = [
      'diff --git a/src/Button.stories.tsx b/src/Button.stories.tsx',
      '--- a/src/Button.stories.tsx',
      '+++ b/src/Button.stories.tsx',
      '@@ -0,0 +1,3 @@',
      '+  const button = canvas.getByRole("button");',
      '+  await expect(getComputedStyle(button).backgroundColor).toBe("rgb(37, 99, 235)");',
    ].join('\n');
    expect(diffAddsTokenInStoryFiles(diff, storyChanges, 'getComputedStyle')).toBe(true);
  });

  it('ignores the token when it only appears in non-story files (prompt.md, data.json)', () => {
    const diff = [
      '+++ b/.storybook/eval-results/prompt.md',
      '+Use getComputedStyle to prove CSS loaded',
      '+++ b/.storybook/eval-results/data.json',
      '+"content": "...getComputedStyle..."',
    ].join('\n');
    expect(diffAddsTokenInStoryFiles(diff, storyChanges, 'getComputedStyle')).toBe(false);
  });

  it('ignores the token on removed lines', () => {
    const diff = [
      '+++ b/src/Button.stories.tsx',
      '-  await expect(getComputedStyle(button).backgroundColor).toBe("red");',
    ].join('\n');
    expect(diffAddsTokenInStoryFiles(diff, storyChanges, 'getComputedStyle')).toBe(false);
  });

  it('does not match the `+++ b/...` file header itself', () => {
    const diff = ['+++ b/src/getComputedStyle-notes.stories.tsx'].join('\n');
    // The header mentions the token, but no content line does. Also the file is not in changes.
    expect(diffAddsTokenInStoryFiles(diff, storyChanges, 'getComputedStyle')).toBe(false);
  });

  it('only considers files present in storybookChanges as story files', () => {
    const diff = [
      '+++ b/src/Button.stories.tsx',
      '+  await expect(getComputedStyle(button).backgroundColor).toBe("red");',
    ].join('\n');
    // Pass an empty list — even though the file is named like a story, it is not in changes.
    expect(diffAddsTokenInStoryFiles(diff, [], 'getComputedStyle')).toBe(false);
  });

  it('ignores non-story storybook files like .storybook/preview.tsx', () => {
    const diff = [
      '+++ b/.storybook/preview.tsx',
      '+import { initialize } from "getComputedStyle";',
    ].join('\n');
    expect(diffAddsTokenInStoryFiles(diff, storyChanges, 'getComputedStyle')).toBe(false);
  });

  it('returns false for an empty diff', () => {
    expect(diffAddsTokenInStoryFiles('', storyChanges, 'getComputedStyle')).toBe(false);
  });
});

describe('computeQualityScore', () => {
  it('uses normalized preview gain as the score', () => {
    const result = computeQualityScore({
      baselinePreviewStories: { passed: 1, total: 4 },
      storyRender: { passed: 4, total: 4 },
    });
    expect(result.score).toBe(1);
    expect(result.breakdown.beforeRate).toBeCloseTo(0.25);
    expect(result.breakdown.afterRate).toBeCloseTo(1);
    expect(result.breakdown.gain).toBe(1);
  });

  it('returns 0 when either baseline or post-run story data is missing', () => {
    expect(computeQualityScore({ baselinePreviewStories: { passed: 1, total: 5 } }).score).toBe(0);
    expect(computeQualityScore({ storyRender: { passed: 4, total: 5 } }).score).toBe(0);
    expect(computeQualityScore({}).score).toBe(0);
  });

  it('returns 0 when story render coverage regresses', () => {
    const result = computeQualityScore({
      baselinePreviewStories: { passed: 3, total: 4 },
      storyRender: { passed: 2, total: 4 },
    });
    expect(result.score).toBe(0);
    expect(result.breakdown.gain).toBe(0);
  });

  it('uses normalized gain for partial improvements', () => {
    const result = computeQualityScore({
      baselinePreviewStories: { passed: 2, total: 6 },
      storyRender: { passed: 4, total: 6 },
    });
    expect(result.score).toBeCloseTo(0.5);
    expect(result.breakdown.beforeRate).toBe(2 / 6);
    expect(result.breakdown.afterRate).toBe(4 / 6);
    expect(result.breakdown.gain).toBeCloseTo(0.5);
  });

  it('returns 0 when baseline and final are both perfect (no remaining gap to improve)', () => {
    const result = computeQualityScore({
      baselinePreviewStories: { passed: 4, total: 4 },
      storyRender: { passed: 4, total: 4 },
    });
    expect(result.score).toBe(0);
    expect(result.breakdown.gain).toBe(0);
  });
});

describe('countTypeCheckErrors', () => {
  it('counts zero for clean output', () => {
    expect(countTypeCheckErrors('')).toBe(0);
    expect(countTypeCheckErrors('All good\nNo issues')).toBe(0);
  });

  it('counts TypeScript error codes', () => {
    const output = [
      "src/App.tsx(3,1): error TS2304: Cannot find name 'foo'.",
      "src/App.tsx(5,1): error TS2322: Type 'string' is not assignable.",
      'Found 2 errors.',
    ].join('\n');
    expect(countTypeCheckErrors(output)).toBe(2);
  });

  it('counts multiple errors on the same line', () => {
    expect(countTypeCheckErrors('error TS1234 and error TS5678 on same line')).toBe(2);
  });

  it('does not count non-error TS references', () => {
    expect(countTypeCheckErrors('TS2304 without error prefix')).toBe(0);
    expect(countTypeCheckErrors('warning TS1234')).toBe(0);
  });
});

describe('parseChangedFiles', () => {
  it('parses added, modified, deleted, and renamed files', () => {
    const output =
      'A\tsrc/new-file.ts\nM\tsrc/existing.ts\nD\tsrc/removed.ts\nR100\told.ts\tnew.ts';
    expect(parseChangedFiles(output)).toMatchObject([
      { path: 'src/new-file.ts', gitStatus: 'A' },
      { path: 'src/existing.ts', gitStatus: 'M' },
      { path: 'src/removed.ts', gitStatus: 'D' },
      { path: 'new.ts', previousPath: 'old.ts', gitStatus: 'R' },
    ]);
  });

  it('handles empty output', () => {
    expect(parseChangedFiles('')).toEqual([]);
    expect(parseChangedFiles('\n')).toEqual([]);
  });

  it('handles single file', () => {
    expect(parseChangedFiles('M\tpackage.json')).toEqual([
      { path: 'package.json', gitStatus: 'M' },
    ]);
  });
});
