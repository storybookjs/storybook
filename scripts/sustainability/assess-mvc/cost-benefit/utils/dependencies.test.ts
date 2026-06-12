import { describe, expect, it } from 'vitest';

import { computeDependencyDiff } from './dependencies.ts';

describe('computeDependencyDiff', () => {
  it('reports added top-level entry names', () => {
    const patch = `@@ -100,0 +100,9 @@
+"@actions/core@npm:^1.11.1":
+  version: 1.11.1
+  resolution: "@actions/core@npm:1.11.1"
+  checksum: dead
+  languageName: node
+  linkType: hard
+
+"react@npm:^18.3.1":
+  version: 18.3.1
`;
    expect(
      computeDependencyDiff([
        { path: 'yarn.lock', additions: 9, deletions: 0, patch, status: 'modified' },
      ])
    ).toEqual({ added: ['@actions/core', 'react'], removed: [], delta: 2 });
  });

  it('reports removed top-level entry names', () => {
    const patch = `@@ -10,5 +10,0 @@
-"@old/dep@npm:^1.0.0":
-  version: 1.0.0
-
-"unrelated-old@npm:^2.0.0":
-  version: 2.0.0
`;
    expect(
      computeDependencyDiff([
        { path: 'yarn.lock', additions: 0, deletions: 5, patch, status: 'modified' },
      ])
    ).toEqual({ added: [], removed: ['@old/dep', 'unrelated-old'], delta: -2 });
  });

  it('filters out version bumps (same name on both sides)', () => {
    const patch = `@@ -10,3 +10,3 @@
-"react@npm:^18.3.0":
-  version: 18.3.0
+"react@npm:^18.3.1":
+  version: 18.3.1
`;
    expect(
      computeDependencyDiff([
        { path: 'yarn.lock', additions: 2, deletions: 2, patch, status: 'modified' },
      ])
    ).toEqual({ added: [], removed: [], delta: 0 });
  });

  it('reports a net-positive delta when adds dominate', () => {
    const patch = `@@ -1,0 +1,4 @@
+"a@npm:^1":
+  version: 1
+"b@npm:^1":
+  version: 1
@@ -10,2 +10,0 @@
-"c@npm:^1":
-  version: 1
`;
    expect(
      computeDependencyDiff([
        { path: 'yarn.lock', additions: 4, deletions: 2, patch, status: 'modified' },
      ])
    ).toMatchObject({ added: ['a', 'b'], removed: ['c'], delta: 1 });
  });

  it('reports a net-negative delta when removals dominate (cleanup / security)', () => {
    const patch = `@@ -1,0 +1,1 @@
+"newer@npm:^1":
+  version: 1
@@ -10,4 +10,0 @@
-"old-a@npm:^1":
-  version: 1
-"old-b@npm:^2":
-  version: 2
-"old-c@npm:^3":
-  version: 3
`;
    expect(
      computeDependencyDiff([
        { path: 'yarn.lock', additions: 1, deletions: 4, patch, status: 'modified' },
      ])
    ).toMatchObject({
      added: ['newer'],
      removed: ['old-a', 'old-b', 'old-c'],
      delta: -2,
    });
  });

  it('handles multi-key entries by taking the first range as the canonical name', () => {
    const patch = `@@ -1,0 +1,2 @@
+"@types/foo@npm:^1, @types/foo@npm:^2":
+  version: 2.0.0
`;
    expect(
      computeDependencyDiff([
        { path: 'yarn.lock', additions: 2, deletions: 0, patch, status: 'modified' },
      ])
    ).toEqual({ added: ['@types/foo'], removed: [], delta: 1 });
  });

  it('returns zeros when no yarn.lock is in the diff', () => {
    expect(
      computeDependencyDiff([
        {
          path: 'package.json',
          additions: 1,
          deletions: 0,
          patch: '+ "foo": "1"',
          status: 'modified',
        },
      ])
    ).toEqual({ added: [], removed: [], delta: 0 });
  });

  it('returns zeros when yarn.lock has no patch (binary or oversized)', () => {
    expect(
      computeDependencyDiff([
        { path: 'yarn.lock', additions: 1000, deletions: 0, status: 'modified' },
      ])
    ).toEqual({ added: [], removed: [], delta: 0 });
  });
});
