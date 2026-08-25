import { describe, expect, it } from 'vitest';

import {
  type FileSnapshotCache,
  ProjectFileTracker,
  filterSourceFilePaths,
} from './ProjectFileTracker.ts';

describe('filterSourceFilePaths', () => {
  it('drops files under a node_modules directory', () => {
    expect(
      filterSourceFilePaths([
        '/repo/src/Button.tsx',
        '/repo/node_modules/react/index.d.ts',
        'node_modules/csstype/index.d.ts',
      ])
    ).toEqual(['/repo/src/Button.tsx']);
  });

  it('keeps a source directory that merely starts with `node_modules`', () => {
    // A substring test would drop these, leaving their components without metadata and without a
    // watcher, so an edit would never invalidate.
    expect(
      filterSourceFilePaths(['/repo/src/node_modules-tools/Tag.tsx', '/repo/my_node_modules/a.ts'])
    ).toEqual(['/repo/src/node_modules-tools/Tag.tsx', '/repo/my_node_modules/a.ts']);
  });

  it('normalizes Windows separators', () => {
    expect(filterSourceFilePaths(['C:\\repo\\src\\Button.tsx'])).toEqual([
      'C:/repo/src/Button.tsx',
    ]);
    expect(filterSourceFilePaths(['C:\\repo\\node_modules\\react\\index.d.ts'])).toEqual([]);
  });
});

describe('ProjectFileTracker path keys', () => {
  const createTracker = () => {
    const snapshots: FileSnapshotCache<string> = new Map();
    const tracker = new ProjectFileTracker<string>(
      {
        sys: {
          fileExists: () => true,
          readFile: () => 'export const Tag = () => null;',
          getModifiedTime: () => new Date(1000),
        },
      },
      { fileNames: ['C:/repo/Tag.tsx'] },
      snapshots,
      (text) => text
    );
    return { tracker, snapshots };
  };

  it('reads a backslash path out of the cache a forward-slash path filled', () => {
    // TypeScript asks with forward slashes; watcher events and Storybook story paths can arrive with
    // backslashes. Both have to land on one entry or a rewrite is served from a stale snapshot.
    const { tracker, snapshots } = createTracker();

    tracker.getSnapshot('C:/repo/Tag.tsx');
    expect([...snapshots.keys()]).toEqual(['C:/repo/Tag.tsx']);

    tracker.getSnapshot('C:\\repo\\Tag.tsx');
    expect([...snapshots.keys()]).toEqual(['C:/repo/Tag.tsx']);
  });

  it('invalidates a forward-slash snapshot from a backslash change event', () => {
    const { tracker, snapshots } = createTracker();

    tracker.getSnapshot('C:/repo/Tag.tsx');
    const before = tracker.getScriptVersion('C:/repo/Tag.tsx');

    tracker.onFilesChanged([{ filePath: 'C:\\repo\\Tag.tsx', type: 'changed' }], () => true);

    expect(snapshots.has('C:/repo/Tag.tsx')).toBe(false);
    // The edit counter is what moves here: the mtime is pinned, so a version derived from mtime
    // alone would be unchanged and the DocumentRegistry would keep serving the old AST.
    expect(tracker.getScriptVersion('C:\\repo\\Tag.tsx')).not.toBe(before);
  });
});
