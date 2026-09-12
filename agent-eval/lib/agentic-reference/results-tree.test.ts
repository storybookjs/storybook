import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findStoredEvalDirs } from './results-tree.ts';

describe('findStoredEvalDirs', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'results-tree-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('finds eval directories in the single-model layout', () => {
    mkdirSync(join(root, 'agentic-ref-a', '2026-08-15T13-20-41.492Z', '701-x', 'run-1'), {
      recursive: true,
    });
    expect(findStoredEvalDirs(root)).toEqual([
      {
        dir: join(root, 'agentic-ref-a', '2026-08-15T13-20-41.492Z', '701-x'),
        experiment: 'agentic-ref-a',
        model: '',
        timestamp: '2026-08-15T13-20-41.492Z',
        evalName: '701-x',
      },
    ]);
  });

  it('reads the model segment of a multi-model layout', () => {
    mkdirSync(join(root, 'agentic-ref-a', 'opus', '2026-08-15T13-20-41.492Z', '701-x', 'run-2'), {
      recursive: true,
    });
    expect(findStoredEvalDirs(root)).toMatchObject([
      { experiment: 'agentic-ref-a', model: 'opus', evalName: '701-x' },
    ]);
  });

  it('skips directories that hold no runs', () => {
    mkdirSync(join(root, 'agentic-ref-a', '2026-08-15T13-20-41.492Z', '701-x'), {
      recursive: true,
    });
    expect(findStoredEvalDirs(root)).toEqual([]);
  });

  it('finds nothing under a directory that does not exist', () => {
    expect(findStoredEvalDirs(join(root, 'missing'))).toEqual([]);
  });
});
