import { describe, expect, it } from 'vitest';

import { computeAddedDependencies } from './dependencies.ts';

describe('computeAddedDependencies', () => {
  it('extracts top-level entry names from a yarn.lock patch', () => {
    const patch = `@@ -100,6 +100,15 @@
+"@actions/core@npm:^1.11.1":
+  version: 1.11.1
+  resolution: "@actions/core@npm:1.11.1"
+  checksum: deadbeef
+  languageName: node
+  linkType: hard
+
+"react@npm:^18.3.1":
+  version: 18.3.1
`;
    expect(computeAddedDependencies([
      { path: 'yarn.lock', additions: 9, deletions: 0, patch, status: 'modified' },
    ])).toEqual(['@actions/core', 'react']);
  });

  it('extracts the name from a multi-key entry', () => {
    const patch = `@@ -1,3 +1,4 @@
+"@types/foo@npm:^1, @types/foo@npm:^2":
+  version: 2.0.0
`;
    expect(computeAddedDependencies([
      { path: 'yarn.lock', additions: 2, deletions: 0, patch, status: 'modified' },
    ])).toEqual(['@types/foo']);
  });

  it('dedupes when the same name appears twice', () => {
    const patch = `@@ -1,4 +1,8 @@
+"foo@npm:^1":
+  version: 1.0.0
+"foo@npm:^2":
+  version: 2.0.0
`;
    expect(computeAddedDependencies([
      { path: 'yarn.lock', additions: 4, deletions: 0, patch, status: 'modified' },
    ])).toEqual(['foo']);
  });

  it('returns [] when no yarn.lock is in the diff', () => {
    expect(computeAddedDependencies([
      { path: 'package.json', additions: 1, deletions: 0, patch: '+ "foo": "1"', status: 'modified' },
    ])).toEqual([]);
  });

  it('returns [] when yarn.lock has no patch (binary or oversized)', () => {
    expect(computeAddedDependencies([
      { path: 'yarn.lock', additions: 1000, deletions: 0, status: 'modified' },
    ])).toEqual([]);
  });

  it('ignores property lines under existing entries', () => {
    const patch = `@@ -10,5 +10,6 @@
 "react@npm:^18.3.1":
-  version: 18.3.0
+  version: 18.3.1
+  resolution: "react@npm:18.3.1"
`;
    expect(computeAddedDependencies([
      { path: 'yarn.lock', additions: 2, deletions: 1, patch, status: 'modified' },
    ])).toEqual([]);
  });
});
