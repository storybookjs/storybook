import { describe, expect, it } from 'vitest';

import { createPrecompile, pickEmberOptions, withEmberRule } from './compiler.ts';
import type { EmberTemplateOptions } from './types.ts';

describe('createPrecompile', () => {
  it.each<{
    name: string;
    emberOptions: (polyfill: () => object) => EmberTemplateOptions | undefined;
    expected: number;
  }>([
    { name: 'without options', emberOptions: () => undefined, expected: 0 },
    { name: 'without polyfills', emberOptions: () => ({}), expected: 0 },
    {
      name: 'with polyfills',
      emberOptions: (polyfill) => ({ polyfills: [polyfill] }),
      expected: 1,
    },
  ])('runs AST polyfills $expected times $name', ({ emberOptions, expected }) => {
    let runs = 0;
    const polyfill = (): object => {
      runs += 1;
      return { name: 'probe', visitor: {} };
    };

    createPrecompile(emberOptions(polyfill))('<div></div>', {});

    expect(runs).toBe(expected);
  });
});

describe('withEmberRule', () => {
  it.each([
    {
      name: 'compiles TypeScript by default',
      typescriptOptions: {},
      test: '/\\.((c|m)?(j|t)sx?)$/',
    },
    {
      name: 'skips TypeScript with skipCompiler',
      typescriptOptions: { skipCompiler: true },
      test: '/\\.((c|m)?jsx?)$/',
    },
  ])('$name', ({ typescriptOptions, test }) => {
    const config = withEmberRule(
      { module: { rules: [{ test: /\.css$/ }] } },
      { babelOptions: {}, typescriptOptions, previewModuleIds: { entry: '/preview/entry.js' } }
    );

    const rules = config.module?.rules as { test: RegExp; exclude?: unknown[] }[];
    expect({
      ruleCount: rules.length,
      test: String(rules[1].test),
      exclude: rules[1].exclude?.map(String),
    }).toEqual({ ruleCount: 2, test, exclude: ['/node_modules/', '/preview/entry.js'] });
  });
});

describe('pickEmberOptions', () => {
  it.each<{
    name: string;
    input: {
      frameworkOptions: EmberTemplateOptions | undefined;
      main: EmberTemplateOptions | undefined;
    };
    expected: EmberTemplateOptions | undefined;
  }>([
    {
      name: 'prefers the factory options over main',
      input: { frameworkOptions: { polyfills: ['factory'] }, main: { polyfills: ['main'] } },
      expected: { polyfills: ['factory'] },
    },
    {
      name: 'falls back to main without factory options',
      input: { frameworkOptions: undefined, main: { polyfills: ['main'] } },
      expected: { polyfills: ['main'] },
    },
    {
      name: 'returns nothing when neither is set',
      input: { frameworkOptions: undefined, main: undefined },
      expected: undefined,
    },
  ])('$name', ({ input, expected }) => {
    expect(
      pickEmberOptions({ emberOptions: input.frameworkOptions }, { emberOptions: input.main })
    ).toEqual(expected);
  });
});
