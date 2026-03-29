import { describe, expect, it } from 'vitest';

import {
  filterStorybookFiles,
  computeQualityScore,
  countTypeCheckErrors,
  parseChangedFiles,
} from './grade';
import type { FileChange } from '../types';

describe('filterStorybookFiles', () => {
  it('matches files in .storybook/ directory', () => {
    const files: FileChange[] = [
      { path: '.storybook/main.ts', status: 'M' },
      { path: '.storybook/preview.tsx', status: 'A' },
      { path: 'src/App.tsx', status: 'M' },
    ];
    expect(filterStorybookFiles(files)).toMatchObject([
      { path: '.storybook/main.ts', status: 'M' },
      { path: '.storybook/preview.tsx', status: 'A' },
    ]);
  });

  it('matches story files with various extensions', () => {
    const files: FileChange[] = [
      { path: 'src/Button.stories.tsx', status: 'A' },
      { path: 'src/Header.stories.ts', status: 'A' },
      { path: 'src/Page.story.jsx', status: 'A' },
      { path: 'src/utils.stories.js', status: 'A' },
      { path: 'src/Button.tsx', status: 'M' },
      { path: 'src/Button.test.tsx', status: 'M' },
    ];
    expect(filterStorybookFiles(files)).toMatchObject(files.slice(0, 4));
  });

  it('returns empty for no storybook files', () => {
    const files: FileChange[] = [
      { path: 'src/App.tsx', status: 'M' },
      { path: 'package.json', status: 'M' },
    ];
    expect(filterStorybookFiles(files)).toHaveLength(0);
  });

  it('handles empty input', () => {
    expect(filterStorybookFiles([])).toHaveLength(0);
  });

  it('matches renamed files using either side of the rename', () => {
    const files: FileChange[] = [
      { path: 'src/Button.tsx', previousPath: 'src/Button.stories.tsx', status: 'R' },
      { path: '.storybook/preview.tsx', previousPath: 'config/preview.tsx', status: 'R' },
      { path: 'src/App.tsx', previousPath: 'src/Main.tsx', status: 'R' },
    ];

    expect(filterStorybookFiles(files)).toMatchObject(files.slice(0, 2));
  });
});

describe('computeQualityScore', () => {
  // Weights: 40% ghost, 25% build, 25% typecheck, 10% performance

  it('returns 1.0 when everything passes and agent is fast', () => {
    const result = computeQualityScore({
      buildSuccess: true, typeCheckErrors: 0, ghostSuccessRate: 1.0, durationSeconds: 60,
    });
    expect(result.score).toBe(1);
    expect(result.breakdown).toEqual({ build: 1, typecheck: 1, ghostStories: 1, performance: 1 });
  });

  it('ghost stories have 40% weight', () => {
    const result = computeQualityScore({
      buildSuccess: false, typeCheckErrors: 20, ghostSuccessRate: 1.0, durationSeconds: 600,
    });
    expect(result.score).toBe(0.4);
  });

  it('build has 25% weight', () => {
    const result = computeQualityScore({
      buildSuccess: true, typeCheckErrors: 20, ghostSuccessRate: 0, durationSeconds: 600,
    });
    expect(result.score).toBe(0.25);
  });

  it('performance has 10% weight', () => {
    const result = computeQualityScore({
      buildSuccess: false, typeCheckErrors: 20, ghostSuccessRate: 0, durationSeconds: 60,
    });
    expect(result.score).toBe(0.1);
  });

  it('returns 0 when everything fails', () => {
    const result = computeQualityScore({
      buildSuccess: false, typeCheckErrors: 20, ghostSuccessRate: 0, durationSeconds: 600,
    });
    expect(result.score).toBe(0);
  });

  it('scales typecheck score linearly', () => {
    const result = computeQualityScore({
      buildSuccess: true, typeCheckErrors: 10, ghostSuccessRate: 1.0, durationSeconds: 60,
    });
    expect(result.breakdown.typecheck).toBe(0.5);
  });

  it('clamps typecheck score at 0 for >= 20 errors', () => {
    const a = computeQualityScore({ buildSuccess: true, typeCheckErrors: 20, ghostSuccessRate: 1.0, durationSeconds: 60 });
    const b = computeQualityScore({ buildSuccess: true, typeCheckErrors: 50, ghostSuccessRate: 1.0, durationSeconds: 60 });
    expect(a.breakdown.typecheck).toBe(0);
    expect(b.breakdown.typecheck).toBe(0);
  });

  it('treats undefined ghost stories as 0', () => {
    const a = computeQualityScore({ buildSuccess: true, typeCheckErrors: 0, ghostSuccessRate: 0, durationSeconds: 60 });
    const b = computeQualityScore({ buildSuccess: true, typeCheckErrors: 0, durationSeconds: 60 });
    expect(a.score).toBe(b.score);
  });

  it('performance: ≤120s scores 1.0', () => {
    const a = computeQualityScore({ buildSuccess: true, typeCheckErrors: 0, ghostSuccessRate: 1.0, durationSeconds: 0 });
    const b = computeQualityScore({ buildSuccess: true, typeCheckErrors: 0, ghostSuccessRate: 1.0, durationSeconds: 120 });
    expect(a.breakdown.performance).toBe(1);
    expect(b.breakdown.performance).toBe(1);
  });

  it('performance: 360s scores 0.5', () => {
    const r = computeQualityScore({ buildSuccess: true, typeCheckErrors: 0, ghostSuccessRate: 1.0, durationSeconds: 360 });
    expect(r.breakdown.performance).toBe(0.5);
  });

  it('performance: ≥600s scores 0', () => {
    const a = computeQualityScore({ buildSuccess: true, typeCheckErrors: 0, ghostSuccessRate: 1.0, durationSeconds: 600 });
    const b = computeQualityScore({ buildSuccess: true, typeCheckErrors: 0, ghostSuccessRate: 1.0, durationSeconds: 1000 });
    expect(a.breakdown.performance).toBe(0);
    expect(b.breakdown.performance).toBe(0);
  });

  it('performance: undefined duration scores 0', () => {
    const r = computeQualityScore({ buildSuccess: true, typeCheckErrors: 0, ghostSuccessRate: 1.0 });
    expect(r.breakdown.performance).toBe(0);
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
    const output = 'A\tsrc/new-file.ts\nM\tsrc/existing.ts\nD\tsrc/removed.ts\nR100\told.ts\tnew.ts';
    expect(parseChangedFiles(output)).toMatchObject([
      { path: 'src/new-file.ts', status: 'A' },
      { path: 'src/existing.ts', status: 'M' },
      { path: 'src/removed.ts', status: 'D' },
      { path: 'new.ts', previousPath: 'old.ts', status: 'R' },
    ]);
  });

  it('handles empty output', () => {
    expect(parseChangedFiles('')).toEqual([]);
    expect(parseChangedFiles('\n')).toEqual([]);
  });

  it('handles single file', () => {
    expect(parseChangedFiles('M\tpackage.json')).toEqual([{ path: 'package.json', status: 'M' }]);
  });
});
