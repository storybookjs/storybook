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
