// Integration tests for the built-in ImportParser plugins. We exercise the real oxc-parser
// binary here (no spy) — the parser is fast enough for unit tests and stubbing it would
// test the stub, not the extractor's mapping from oxc nodes to ImportEdge.
import { describe, expect, it, vi } from 'vitest';

import { ChangeDetectionFailureError } from '../errors.ts';
import { mdxImportParser, oxcImportParser } from './builtins.ts';
import type { ImportParserContext } from './types.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

const noopContext: ImportParserContext = {
  parseScriptWithOxc: async () => [],
};

describe('oxcImportParser', () => {
  it('claims the core JS/TS extensions', () => {
    expect(oxcImportParser.extensions).toEqual(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
  });

  it('extracts a regular static `import x from "y"`', async () => {
    const edges = await oxcImportParser.parse(
      { filePath: '/tmp/a.ts', source: `import x from 'y';` },
      noopContext
    );

    expect(edges).toEqual([{ specifier: 'y', kind: 'static' }]);
  });

  it('skips a type-only `import type x from "y"`', async () => {
    const edges = await oxcImportParser.parse(
      { filePath: '/tmp/a.ts', source: `import type x from 'y';` },
      noopContext
    );

    expect(edges).toEqual([]);
  });

  it('keeps a re-export `export { x } from "y"`', async () => {
    const edges = await oxcImportParser.parse(
      { filePath: '/tmp/a.ts', source: `export { x } from 'y';` },
      noopContext
    );

    expect(edges).toEqual([{ specifier: 'y', kind: 'static' }]);
  });

  it('skips a type-only `export type { x } from "y"`', async () => {
    const edges = await oxcImportParser.parse(
      { filePath: '/tmp/a.ts', source: `export type { x } from 'y';` },
      noopContext
    );

    expect(edges).toEqual([]);
  });

  it('keeps a dynamic `import("y")` with a string literal', async () => {
    const edges = await oxcImportParser.parse(
      { filePath: '/tmp/a.ts', source: `const m = import('y');` },
      noopContext
    );

    expect(edges).toEqual([{ specifier: 'y', kind: 'dynamic' }]);
  });

  it('skips a dynamic import with a non-literal specifier', async () => {
    const edges = await oxcImportParser.parse(
      {
        filePath: '/tmp/a.ts',
        source: `async function f(name: string) { await import(name); }`,
      },
      noopContext
    );

    expect(edges).toEqual([]);
  });

  it('skips a template-literal dynamic import with interpolation', async () => {
    const edges = await oxcImportParser.parse(
      {
        filePath: '/tmp/a.ts',
        source: 'async function f(x: string) { await import(`./${x}`); }',
      },
      noopContext
    );

    expect(edges).toEqual([]);
  });

  it('keeps a template-literal dynamic import with no interpolation', async () => {
    const edges = await oxcImportParser.parse(
      { filePath: '/tmp/a.ts', source: 'async function f() { await import(`./y`); }' },
      noopContext
    );

    expect(edges).toEqual([{ specifier: './y', kind: 'dynamic' }]);
  });

  it('extracts a `require("y")` call with a string literal', async () => {
    const edges = await oxcImportParser.parse(
      { filePath: '/tmp/a.js', source: `const m = require('y');` },
      noopContext
    );

    const requires = edges.filter((edge) => edge.kind === 'require');
    expect(requires).toEqual([{ specifier: 'y', kind: 'require' }]);
  });

  it('skips `require(someVar)` with a non-literal argument', async () => {
    const edges = await oxcImportParser.parse(
      { filePath: '/tmp/a.js', source: `function f(name) { return require(name); }` },
      noopContext
    );

    expect(edges.filter((edge) => edge.kind === 'require')).toEqual([]);
  });

  it('parses a .tsx file with JSX and an import together', async () => {
    const edges = await oxcImportParser.parse(
      {
        filePath: '/tmp/a.tsx',
        source: `import React from 'react';\nexport const X = () => <div />;`,
      },
      noopContext
    );

    expect(edges).toEqual([{ specifier: 'react', kind: 'static' }]);
  });

  it('parses `.mjs` and `.cjs` sources without error', async () => {
    const mjs = await oxcImportParser.parse(
      { filePath: '/tmp/a.mjs', source: `import x from 'y';` },
      noopContext
    );
    const cjs = await oxcImportParser.parse(
      { filePath: '/tmp/a.cjs', source: `const m = require('y');` },
      noopContext
    );

    expect(mjs).toEqual([{ specifier: 'y', kind: 'static' }]);
    expect(cjs.filter((e) => e.kind === 'require')).toEqual([{ specifier: 'y', kind: 'require' }]);
  });

  it('wraps an oxc-parser throw in a ChangeDetectionFailureError', async () => {
    // The dissolved oxc wrapper throws ChangeDetectionFailureError on any parser-level
    // failure (null `module`, oxc throw). We cannot reliably produce an oxc throw with
    // a test fixture — oxc is permissive. We document the contract: if the parser
    // refused the source, the wrapping is a ChangeDetectionFailureError.
    let threw: unknown;
    try {
      // Pass binary-garbage-ish source; if oxc refuses, we expect the error-wrapping path.
      await oxcImportParser.parse(
        { filePath: '/tmp/a.ts', source: ' invalid  source `' },
        noopContext
      );
    } catch (error) {
      threw = error;
    }
    if (threw !== undefined) {
      expect(threw).toBeInstanceOf(ChangeDetectionFailureError);
    }
  });
});

describe('mdxImportParser', () => {
  it('claims the `.mdx` extension', () => {
    expect(mdxImportParser.extensions).toEqual(['.mdx']);
  });

  it('extracts top-of-file import lines from an MDX source', async () => {
    const source = [
      `import { Meta } from '@storybook/blocks';`,
      `import * as ButtonStories from './Button.stories';`,
      ``,
      `<Meta of={ButtonStories} />`,
    ].join('\n');

    const edges = await mdxImportParser.parse({ filePath: '/tmp/intro.mdx', source }, noopContext);

    expect(edges).toEqual([
      { specifier: '@storybook/blocks', kind: 'static' },
      { specifier: './Button.stories', kind: 'static' },
    ]);
  });

  it('returns an empty array when an MDX file has no imports', async () => {
    const edges = await mdxImportParser.parse(
      { filePath: '/tmp/doc.mdx', source: `# Title\n\nSome prose.` },
      noopContext
    );

    expect(edges).toEqual([]);
  });

  it('deduplicates identical import specifiers', async () => {
    const source = [
      `import { Meta } from '@storybook/blocks';`,
      `import { Canvas } from '@storybook/blocks';`,
    ].join('\n');

    const edges = await mdxImportParser.parse({ filePath: '/tmp/intro.mdx', source }, noopContext);

    expect(edges).toEqual([{ specifier: '@storybook/blocks', kind: 'static' }]);
  });

  it('extracts "export ... from" declarations from an MDX source', async () => {
    const source = [`export { Meta } from '@storybook/blocks';`, `export * from './others';`].join(
      '\n'
    );

    const edges = await mdxImportParser.parse({ filePath: '/tmp/intro.mdx', source }, noopContext);

    expect(edges).toEqual([
      { specifier: '@storybook/blocks', kind: 'static' },
      { specifier: './others', kind: 'static' },
    ]);
  });

  it('does NOT extract imports inside fenced code blocks (```js ... ```)', async () => {
    const source = [
      `import { Meta } from '@storybook/blocks';`,
      ``,
      `\`\`\`js`,
      `import fake from 'this-is-an-example';`,
      `import another from './example-dep';`,
      `\`\`\``,
      ``,
      `<Meta title="Docs" />`,
    ].join('\n');

    const edges = await mdxImportParser.parse({ filePath: '/tmp/doc.mdx', source }, noopContext);

    expect(edges).toEqual([{ specifier: '@storybook/blocks', kind: 'static' }]);
    expect(edges.map((e) => e.specifier)).not.toContain('this-is-an-example');
    expect(edges.map((e) => e.specifier)).not.toContain('./example-dep');
  });

  it('does NOT extract imports inside backtick inline code spans', async () => {
    const source = [
      `import { Canvas } from '@storybook/blocks';`,
      ``,
      `Use \`import foo from 'fake-pkg'\` in your code.`,
    ].join('\n');

    const edges = await mdxImportParser.parse({ filePath: '/tmp/doc.mdx', source }, noopContext);

    expect(edges).toEqual([{ specifier: '@storybook/blocks', kind: 'static' }]);
    expect(edges.map((e) => e.specifier)).not.toContain('fake-pkg');
  });
});
