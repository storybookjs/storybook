import { parse } from '@babel/parser';
import { dedent } from 'ts-dedent';
import { describe, expect, it } from 'vitest';

import { analyze, extractImports } from './docs-mdx.ts';

const parseEstree = (code: string) =>
  parse(code, { sourceType: 'module', plugins: ['jsx', 'estree'] });

describe('extractImports', () => {
  it('extracts imports from a single block', () => {
    const ast = parseEstree(dedent`
      import { Meta } from '@storybook/blocks';
      import * as ButtonStories from './Button.stories';
    `);

    expect(extractImports(ast.program as any)).toMatchInlineSnapshot(`
      {
        "ButtonStories": "./Button.stories",
        "Meta": "@storybook/blocks",
      }
    `);
  });

  it('extracts imports from multiple blocks', () => {
    const ast = parseEstree(dedent`
      import { Meta } from '@storybook/blocks';

      import * as ButtonStories from './Button.stories';
    `);

    expect(extractImports(ast.program as any)).toMatchInlineSnapshot(`
      {
        "ButtonStories": "./Button.stories",
        "Meta": "@storybook/blocks",
      }
    `);
  });
});

describe('analyze', () => {
  it('reads a string literal title', async () => {
    await expect(analyze('# hello\n\n<Meta title="foobar" />')).resolves.toMatchInlineSnapshot(`
      {
        "imports": [],
        "isTemplate": false,
        "metaTags": undefined,
        "name": undefined,
        "of": undefined,
        "summary": undefined,
        "title": "foobar",
      }
    `);
  });

  it('rejects a non-literal title', async () => {
    await expect(
      analyze('# hello\n\n<Meta title={`foobar`} />')
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected string literal title, received JSXExpressionContainer]`
    );
  });

  it('reads a string literal name', async () => {
    await expect(analyze('# hello\n\n<Meta name="foobar" />')).resolves.toMatchInlineSnapshot(`
      {
        "imports": [],
        "isTemplate": false,
        "metaTags": undefined,
        "name": "foobar",
        "of": undefined,
        "summary": undefined,
        "title": undefined,
      }
    `);
  });

  it('rejects an unknown `of` identifier', async () => {
    await expect(analyze('<Meta of={meta} />')).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Unknown identifier meta]`
    );
  });

  it('tracks imported stories referenced by `of`', async () => {
    const input = dedent`
      import { Meta } from '@storybook/blocks';
      import * as ButtonStories from './Button.stories';

      <Meta of={ButtonStories} />
    `;

    await expect(analyze(input)).resolves.toMatchInlineSnapshot(`
      {
        "imports": [
          "@storybook/blocks",
          "./Button.stories",
        ],
        "isTemplate": false,
        "metaTags": undefined,
        "name": undefined,
        "of": "./Button.stories",
        "summary": undefined,
        "title": undefined,
      }
    `);
  });

  it('supports docs with `of` and `name`', async () => {
    const input = dedent`
      import * as AStories from '../src/A.stories';

      <Meta of={AStories} name="Story One" />
    `;

    await expect(analyze(input)).resolves.toMatchInlineSnapshot(`
      {
        "imports": [
          "../src/A.stories",
        ],
        "isTemplate": false,
        "metaTags": undefined,
        "name": "Story One",
        "of": "../src/A.stories",
        "summary": undefined,
        "title": undefined,
      }
    `);
  });

  it('allows exported named declarations after meta', async () => {
    const input = dedent`
      <Meta name="foobar" />
      export const status = "ready";
      export const values = [{ name: 'label' }];
    `;

    await expect(analyze(input)).resolves.toMatchInlineSnapshot(`
      {
        "imports": [],
        "isTemplate": false,
        "metaTags": undefined,
        "name": "foobar",
        "of": undefined,
        "summary": undefined,
        "title": undefined,
      }
    `);
  });

  it('reads a string literal summary', async () => {
    await expect(analyze('<Meta summary="This is a summary." />')).resolves.toMatchInlineSnapshot(`
      {
        "imports": [],
        "isTemplate": false,
        "metaTags": undefined,
        "name": undefined,
        "of": undefined,
        "summary": "This is a summary.",
        "title": undefined,
      }
    `);
  });

  it('supports boolean `isTemplate` variants', async () => {
    await expect(analyze('<Meta isTemplate />')).resolves.toMatchInlineSnapshot(`
      {
        "imports": [],
        "isTemplate": true,
        "metaTags": undefined,
        "name": undefined,
        "of": undefined,
        "summary": undefined,
        "title": undefined,
      }
    `);

    await expect(analyze('<Meta isTemplate={false} />')).resolves.toMatchInlineSnapshot(`
      {
        "imports": [],
        "isTemplate": false,
        "metaTags": undefined,
        "name": undefined,
        "of": undefined,
        "summary": undefined,
        "title": undefined,
      }
    `);
  });

  it('reads string tags', async () => {
    const input = dedent`
      import meta, { Basic } from './Button.stories';

      <Meta of={meta} tags={['a', 'b', 'c']} />
    `;

    await expect(analyze(input)).resolves.toMatchInlineSnapshot(`
      {
        "imports": [
          "./Button.stories",
        ],
        "isTemplate": false,
        "metaTags": [
          "a",
          "b",
          "c",
        ],
        "name": undefined,
        "of": "./Button.stories",
        "summary": undefined,
        "title": undefined,
      }
    `);
  });

  it('matches the external package result for malformed MDX', async () => {
    const input = dedent`
      import meta, { Basic } from './Button.stories';

      <Meta of={meta} />/>
    `;

    await expect(analyze(input)).resolves.toMatchInlineSnapshot(`
      {
        "imports": [
          "./Button.stories",
        ],
        "isTemplate": false,
        "metaTags": undefined,
        "name": undefined,
        "of": undefined,
        "summary": undefined,
        "title": undefined,
      }
    `);
  });

  it('rejects duplicate Meta declarations', async () => {
    const input = dedent`
      <Meta title="foobar" />
      <Meta title="baz" />
    `;

    await expect(analyze(input)).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Meta can only be declared once]`
    );
  });
});
