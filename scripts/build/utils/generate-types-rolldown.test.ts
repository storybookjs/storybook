import { join, relative } from 'pathe';
import { expect, it } from 'vitest';

import {
  assertNoRelativeAugmentations,
  createAugmentationSideEffects,
  getDtsTempTsconfigPaths,
  restoreSideEffectImports,
} from './generate-types-rolldown.ts';

const DIR_ROOT = join(import.meta.dirname, '..', '..', '..');

it.each([
  { input: 'code/lib/mcp', expected: 'tsconfig.dts-tmp-code-lib-mcp.json' },
  { input: 'code/addons/mcp', expected: 'tsconfig.dts-tmp-code-addons-mcp.json' },
  {
    input: 'code/frameworks/react-vite',
    expected: 'tsconfig.dts-tmp-code-frameworks-react-vite.json',
  },
])('names the temp tsconfig of $input $expected', ({ input, expected }) => {
  const { wrapper, emit } = getDtsTempTsconfigPaths(join(DIR_ROOT, input));

  expect(relative(DIR_ROOT, wrapper)).toBe(expected);
  expect(relative(DIR_ROOT, emit)).toBe(expected.replace(/\.json$/, '-emit.json'));
});

it.each([
  {
    name: 'package augmentation in a module',
    input: { id: '/a.d.ts', external: false, text: "import type {} from 'x';\ndeclare module 'x' {\n}" },
    expected: true,
  },
  {
    name: 'ambient module in a script file',
    input: { id: '/a.d.ts', external: false, text: "declare module 'x' {\n}" },
    expected: false,
  },
  {
    name: 'shorthand module declaration',
    input: { id: '/a.d.ts', external: false, text: "export {};\ndeclare module '*.css';" },
    expected: false,
  },
  {
    name: 'plain declarations',
    input: { id: '/a.d.ts', external: false, text: 'export declare const a: number;' },
    expected: false,
  },
  {
    name: 'non-declaration module',
    input: { id: '/a.ts', external: false, text: "export {};\ndeclare module 'x' {\n}" },
    expected: false,
  },
  {
    name: 'external imported bare',
    input: { id: 'pkg/hooks', external: true, text: '' },
    expected: true,
  },
  {
    name: 'external imported for bindings',
    input: { id: 'pkg', external: true, text: '' },
    expected: false,
  },
])('side effects of $name: $expected', ({ input, expected }) => {
  const sideEffects = createAugmentationSideEffects(new Set(['pkg/hooks']), () => input.text);

  expect(sideEffects(input.id, input.external)).toBe(expected);
});

it.each([
  {
    name: 'restores a dropped chunk import',
    input: { code: 'export {};\n', fileName: 'a/entry.d.ts', imports: ['chunk-x.d.ts'] },
    expected: 'import "../chunk-x.js";\nexport {};\n',
  },
  {
    name: 'restores a dropped bare external import',
    input: { code: 'export {};\n', fileName: 'entry.d.ts', imports: ['pkg/hooks'] },
    expected: 'import "pkg/hooks";\nexport {};\n',
  },
  {
    name: 'keeps imports that are still present',
    input: {
      code: 'import { a } from "./chunk-x.js";\nimport { b } from "pkg/hooks";\n',
      fileName: 'entry.d.ts',
      imports: ['chunk-x.d.ts', 'pkg/hooks'],
    },
    expected: 'import { a } from "./chunk-x.js";\nimport { b } from "pkg/hooks";\n',
  },
  {
    name: 'ignores runtime helper chunks and other externals',
    input: { code: 'export {};\n', fileName: 'entry.d.ts', imports: ['chunk-y.js', 'pkg'] },
    expected: 'export {};\n',
  },
])('$name', ({ input, expected }) => {
  expect(
    restoreSideEffectImports(input.code, input.fileName, input.imports, new Set(['pkg/hooks']))
  ).toBe(expected);
});

it('rejects bundled relative augmentations', () => {
  expect(() =>
    assertNoRelativeAugmentations([
      { fileName: 'ok.d.ts', code: "declare module '@storybook/core' {}" },
      { fileName: 'bad.d.ts', code: "export {};\ndeclare module './hooks.ts' {}" },
    ])
  ).toThrowErrorMatchingInlineSnapshot(`
    [Error: Bundled declarations augment relative modules, which consumers cannot resolve:
      bad.d.ts: declare module './hooks.ts'
    Augment the public specifier (e.g. '@storybook/core') or extend the interface directly.]
  `);
});
