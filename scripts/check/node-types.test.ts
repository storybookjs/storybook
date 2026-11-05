import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { findUndeclaredNodeTypes } from './node-types.ts';

const fixture = (name: string) => join(import.meta.dirname, '__testfixtures__', 'node-types', name);

describe('findUndeclaredNodeTypes', () => {
  it('accepts a package that imports a Node built-in and declares its types', () => {
    expect(findUndeclaredNodeTypes(fixture('declared'))).toBeUndefined();
  });

  it('accepts a package that imports no Node built-ins', () => {
    expect(findUndeclaredNodeTypes(fixture('no-builtins'))).toBeUndefined();
  });

  it('reports an unprefixed built-in import with both missing declarations', () => {
    expect(findUndeclaredNodeTypes(fixture('undeclared'))).toMatchInlineSnapshot(`
      "src/index.ts imports a Node built-in, so this package must list "node" in compilerOptions.types and declare @types/node in devDependencies.
      Since TypeScript 6, @types packages are only included when listed, so without this the
      Node types arrive only if a dependency happens to reference them."
    `);
  });
});
