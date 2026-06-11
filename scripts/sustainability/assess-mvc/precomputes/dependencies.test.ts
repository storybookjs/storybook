import { describe, expect, it } from 'vitest';

import { computeAddedDependencies } from './dependencies.ts';

describe('computeAddedDependencies', () => {
  const samplePatch = `@@ -10,7 +10,8 @@
   "dependencies": {
-    "foo": "^1.0.0"
+    "foo": "^1.0.0",
+    "bar": "^2.1.3"
   },
   "peerDependencies": {
+    "baz": "^3.0.0"
   }`;

  it('extracts new runtime + peer deps from package.json patches', () => {
    const result = computeAddedDependencies([
      { path: 'package.json', additions: 2, deletions: 0, patch: samplePatch, status: 'modified' },
    ]);
    expect(result).toEqual({
      runtime: ['bar@^2.1.3'],
      peer: ['baz@^3.0.0'],
    });
  });

  it('ignores devDependencies', () => {
    const patch = `@@ -1,3 +1,5 @@
   "devDependencies": {
+    "vitest": "^1.0.0"
   }`;
    expect(
      computeAddedDependencies([
        { path: 'package.json', additions: 1, deletions: 0, patch, status: 'modified' },
      ])
    ).toEqual({ runtime: [], peer: [] });
  });

  it('returns empty when no package.json changes', () => {
    expect(
      computeAddedDependencies([{ path: 'a.ts', additions: 1, deletions: 0, status: 'modified' }])
    ).toEqual({ runtime: [], peer: [] });
  });
});
