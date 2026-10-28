import { expect, it } from 'vitest';

import { resolveDocsConfig } from './docs-config.ts';

it.each([
  {
    name: 'defaults the entry name',
    input: undefined,
    ctx: {},
    expected: { defaultName: 'Docs' },
  },
  {
    name: 'keeps main.ts docs and the configured name',
    input: { docsMode: false },
    ctx: { defaultName: 'Overview' },
    expected: { docsMode: false, defaultName: 'Overview' },
  },
  {
    name: 'applies the --docs flag',
    input: {},
    ctx: { docsMode: true },
    expected: { defaultName: 'Docs', docsMode: true },
  },
  {
    name: 'drops docs when a test build disables autodocs',
    input: { defaultName: 'Docs' },
    ctx: { build: { test: { disableAutoDocs: true } } },
    expected: undefined,
  },
])('$name', ({ input, ctx, expected }) => {
  expect(resolveDocsConfig(input, ctx)).toEqual(expected);
});
