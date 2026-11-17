import { parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';
import { types as t } from 'storybook/internal/babel';

import { readStaticArgs } from './static-args.ts';
import { printSvelteCsfSnippet } from './svelte-csf-snippets.ts';
import { printPlainCsfSnippet } from './plain-csf-snippets.ts';

describe('server snippet printing', () => {
  it('omits default spread props and preserves strings containing args references', () => {
    const args = { count: 0, primary: false, label: 'code args.count done' };
    const argTypes = {
      count: { table: { defaultValue: { summary: '0' } } },
      primary: { table: { defaultValue: { summary: 'false' } } },
    };
    expect(printSvelteCsfSnippet({ code: '<Panel {...args} />', args, argTypes })).toBe(
      '<Panel label="code args.count done" />'
    );
    expect(printPlainCsfSnippet({ componentName: 'Panel', args, argTypes })).toBe(
      '<Panel label="code args.count done" />'
    );
  });

  it('substitutes text and quoted attributes without adding JSON quotes', () => {
    expect(
      printSvelteCsfSnippet({
        code: '<Panel title="Title: {args.title}" count={args.count}><h1>{args.title}</h1></Panel>',
        args: { title: 'Save', count: 3 },
        argTypes: {},
      })
    ).toBe('<Panel title="Title: Save" count={3}><h1>Save</h1></Panel>');
  });

  it('keeps strings that contain markup as expressions', () => {
    expect(
      printSvelteCsfSnippet({
        code: '<Panel>{args.label}</Panel>',
        args: { label: '<b>Save</b>' },
        argTypes: {},
      })
    ).toBe('<Panel>{"<b>Save</b>"}</Panel>');
  });

  it('reports an unresolved nested value instead of silently dropping it', () => {
    expect(
      readStaticArgs({
        label: t.stringLiteral('Save'),
        config: t.objectExpression([
          t.objectProperty(t.identifier('key'), t.callExpression(t.identifier('load'), [])),
        ]),
        unset: t.identifier('undefined'),
        onclick: t.callExpression(t.identifier('fn'), []),
      })
    ).toEqual({
      args: { label: 'Save', unset: undefined },
      snippets: {},
      unresolved: ['config', 'onclick'],
    });
  });
});

it('prints one space when all spread props are omitted', () => {
  expect(printSvelteCsfSnippet({ code: '<Button {...args} />', args: {}, argTypes: {} })).toBe(
    '<Button />'
  );
});

it('removes the line containing an empty spread', () => {
  expect(
    printSvelteCsfSnippet({ code: '<Button\n  {...args}\n  primary\n/>', args: {}, argTypes: {} })
  ).toBe('<Button\n  primary\n/>');
});

it('preserves expressions in spreads, attributes, text and quoted strings', () => {
  expect(
    printSvelteCsfSnippet({
      code: '<Panel {...args} value={args.data} title="Rows: {args.data.length}">{args.data.length}</Panel>',
      args: {},
      expressions: { data: 'rows.filter((row) => row.enabled)' },
      argTypes: {},
    })
  ).toBe(
    '<Panel data={rows.filter((row) => row.enabled)} value={(rows.filter((row) => row.enabled))} title="Rows: {(rows.filter((row) => row.enabled)).length}">{(rows.filter((row) => row.enabled)).length}</Panel>'
  );
});

it('applies explicit overrides separately for each spread element', () => {
  expect(
    printSvelteCsfSnippet({
      code: '<Panel {...args} label="Explicit" /><Panel label="Earlier" {...args} />',
      args: { label: 'From args', disabled: true },
      argTypes: {},
    })
  ).toBe('<Panel disabled label="Explicit" /><Panel label={"From args"} disabled />');
});

it.each([
  ['<Button>{"args.label"}</Button>', '<Button>{"args.label"}</Button>'],
  ['<!-- args.label --><Button {... args} />', '<!-- args.label --><Button label="Hello" />'],
  ['<Button>{args["label"]}</Button>', '<Button>Hello</Button>'],
  [
    '<Button>{(() => { const args = { label: "local" }; return args.label; })()}</Button>',
    '<Button>{(() => { const args = { label: "local" }; return args.label; })()}</Button>',
  ],
])('changes only references to the story args in %s', (code, expected) => {
  const snippet = printSvelteCsfSnippet({ code, args: { label: 'Hello' }, argTypes: {} });
  expect(snippet).toBe(expected);
  expect(() => parse(snippet, { modern: true })).not.toThrow();
});

it.each([
  ['{#if args.enabled}<Button />{/if}', { enabled: true }, '{#if true}<Button />{/if}'],
  [
    '{#each items as args}<Button>{args.label}</Button>{/each}',
    { label: 'Hello' },
    '{#each items as args}<Button>{args.label}</Button>{/each}',
  ],
  ['<Button {...args}>{args.children}</Button>', { children: 'Hello' }, '<Button>Hello</Button>'],
])('handles expression and binding contexts in %s', (code, args, expected) => {
  const snippet = printSvelteCsfSnippet({ code, args, argTypes: {} });
  expect(snippet).toBe(expected);
  expect(() => parse(snippet, { modern: true })).not.toThrow();
});

it.each([
  '{#await promise then args}<Button label="Local" {...args}>{args.label}</Button>{/await}',
  '<Provider let:args><Button label="Local" {...args}>{args.label}</Button></Provider>',
  '<Provider let:value={args}><Button>{args.label}</Button></Provider>',
  '{#each items as item, args}<Button>{args.label}</Button>{/each}',
])('keeps block-local args separate from story args in %s', (code) => {
  const snippet = printSvelteCsfSnippet({ code, args: { label: 'Story' }, argTypes: {} });
  expect(snippet).toBe(code);
  expect(() => parse(snippet, { modern: true })).not.toThrow();
});

it('uses original source offsets in expressions indented with tabs', () => {
  const snippet = printSvelteCsfSnippet({
    code: '<Markdown\n\t{...wrapProps({\n\t\theight: args.height,\n\t\t...args\n\t})}\n/>',
    args: { height: 20 },
    argTypes: {},
  });
  expect(snippet).toContain('height: 20,');
  expect(snippet).toContain('...args\n\t})}');
  expect(() => parse(snippet, { modern: true })).not.toThrow();
});
