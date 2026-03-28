import { describe, expect, it } from 'vitest';

import {
  filterStorybookFiles,
  computeQualityScore,
  countTypeCheckErrors,
  parseChangedFiles,
} from './grade';
import type { ChangedFile } from '../types';

describe('filterStorybookFiles', () => {
  it('matches files in .storybook/ directory', () => {
    const files: ChangedFile[] = [
      { path: '.storybook/main.ts', status: 'M' },
      { path: '.storybook/preview.tsx', status: 'A' },
      { path: 'src/App.tsx', status: 'M' },
    ];
    const result = filterStorybookFiles(files);
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.path)).toEqual(['.storybook/main.ts', '.storybook/preview.tsx']);
  });

  it('matches story files with various extensions', () => {
    const files: ChangedFile[] = [
      { path: 'src/Button.stories.tsx', status: 'A' },
      { path: 'src/Header.stories.ts', status: 'A' },
      { path: 'src/Page.story.jsx', status: 'A' },
      { path: 'src/utils.stories.js', status: 'A' },
      { path: 'src/Button.tsx', status: 'M' },
      { path: 'src/Button.test.tsx', status: 'M' },
    ];
    const result = filterStorybookFiles(files);
    expect(result).toHaveLength(4);
  });

  it('returns empty for no storybook files', () => {
    const files: ChangedFile[] = [
      { path: 'src/App.tsx', status: 'M' },
      { path: 'package.json', status: 'M' },
    ];
    expect(filterStorybookFiles(files)).toHaveLength(0);
  });

  it('handles empty input', () => {
    expect(filterStorybookFiles([])).toHaveLength(0);
  });
});

describe('computeQualityScore', () => {
  it('returns 1.0 for passing build and zero TS errors', () => {
    const result = computeQualityScore(true, 0);
    expect(result.score).toBe(1);
    expect(result.breakdown.build).toBe(1);
    expect(result.breakdown.typecheck).toBe(1);
  });

  it('returns 0.7 for passing build with many TS errors', () => {
    const result = computeQualityScore(true, 100);
    expect(result.score).toBe(0.7);
    expect(result.breakdown.build).toBe(1);
    expect(result.breakdown.typecheck).toBe(0);
  });

  it('returns 0.3 for failing build with zero TS errors', () => {
    const result = computeQualityScore(false, 0);
    expect(result.score).toBe(0.3);
    expect(result.breakdown.build).toBe(0);
    expect(result.breakdown.typecheck).toBe(1);
  });

  it('returns 0 for failing build with many TS errors', () => {
    const result = computeQualityScore(false, 20);
    expect(result.score).toBe(0);
    expect(result.breakdown.build).toBe(0);
    expect(result.breakdown.typecheck).toBe(0);
  });

  it('scales typecheck score linearly', () => {
    // 10 errors -> tcScore = 1 - 10/20 = 0.5
    const result = computeQualityScore(true, 10);
    expect(result.score).toBe(0.85); // 0.7 + 0.5*0.3
    expect(result.breakdown.typecheck).toBe(0.5);
  });

  it('clamps typecheck score at 0 for >= 20 errors', () => {
    expect(computeQualityScore(true, 20).breakdown.typecheck).toBe(0);
    expect(computeQualityScore(true, 50).breakdown.typecheck).toBe(0);
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
    const output = 'error TS1234 and error TS5678 on same line';
    expect(countTypeCheckErrors(output)).toBe(2);
  });

  it('does not count non-error TS references', () => {
    expect(countTypeCheckErrors('TS2304 without error prefix')).toBe(0);
    expect(countTypeCheckErrors('warning TS1234')).toBe(0);
  });
});

describe('parseChangedFiles', () => {
  it('parses added, modified, deleted, and renamed files', () => {
    const output = 'A\tsrc/new-file.ts\nM\tsrc/existing.ts\nD\tsrc/removed.ts\nR100\told.ts\tnew.ts';
    const result = parseChangedFiles(output);
    expect(result).toEqual([
      { path: 'src/new-file.ts', status: 'A' },
      { path: 'src/existing.ts', status: 'M' },
      { path: 'src/removed.ts', status: 'D' },
      { path: 'old.ts\tnew.ts', status: 'R' },
    ]);
  });

  it('handles empty output', () => {
    expect(parseChangedFiles('')).toEqual([]);
    expect(parseChangedFiles('\n')).toEqual([]);
  });

  it('handles single file', () => {
    const result = parseChangedFiles('M\tpackage.json');
    expect(result).toEqual([{ path: 'package.json', status: 'M' }]);
  });
});
