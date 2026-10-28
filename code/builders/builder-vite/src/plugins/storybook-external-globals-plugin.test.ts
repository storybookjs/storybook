import { expect, it } from 'vitest';

import {
  ensurePreviewRuntimePrecedesGlobals,
  rewriteImport,
} from './storybook-external-globals-plugin.ts';

const packageName = '@storybook/package';
const globals = { [packageName]: '_STORYBOOK_PACKAGE_' };

const cases = [
  {
    globals,
    packageName,
    input: `import { Rain, Jour as Day, Nuit as Night, Sun } from "${packageName}"`,
    output: `const { Rain, Jour: Day, Nuit: Night, Sun } = ${globals[packageName]}`,
  },
  {
    globals,
    packageName,
    input: `import {
      Rain,
      Jour as Day,
      Nuit as Night,
      Sun
    } from "${packageName}"`,
    output: `const {
      Rain,
      Jour: Day,
      Nuit: Night,
      Sun
    } = ${globals[packageName]}`,
  },
  {
    globals,
    packageName,
    input: `import * as Foo from "${packageName}"`,
    output: `const Foo = ${globals[packageName]}`,
  },
  {
    globals,
    packageName,
    input: `import Foo from "${packageName}"`,
    output: `const {default: Foo} = ${globals[packageName]}`,
  },
  {
    globals,
    packageName,
    input: `import {} from "${packageName}"`,
    output: `void ${globals[packageName]}`,
  },
  {
    globals,
    packageName,
    input: `import {} from "${packageName}";`,
    output: `void ${globals[packageName]};`,
  },
  {
    globals,
    packageName,
    input: `import '${packageName}';`,
    output: `void ${globals[packageName]};`,
  },
  {
    globals,
    packageName,
    input: `import{Rain,Jour as Day,Nuit as Night,Sun}from'${packageName}'`,
    output: `const {Rain,Jour: Day,Nuit: Night,Sun} =${globals[packageName]}`,
  },
  {
    globals,
    packageName,
    input: `const { Afternoon } = await import('${packageName}')`,
    output: `const { Afternoon } = ${globals[packageName]}`,
  },
  {
    globals,
    packageName,
    input: `export { Rain, Jour as Day } from '${packageName}';`,
    output: `const { Rain: __sb_reexport_Rain, Jour: __sb_reexport_Day } = ${globals[packageName]}; export { __sb_reexport_Rain as Rain, __sb_reexport_Day as Day };`,
  },
  {
    globals,
    packageName,
    input: `export * as Weather from '${packageName}'`,
    output: `const __sb_reexport_Weather = ${globals[packageName]}; export { __sb_reexport_Weather as Weather }`,
  },
  {
    globals,
    packageName,
    input: `export * from '${packageName}';`,
    output: `export * from '${packageName}';`,
  },
];

it('calls preview setup before a rewritten global', () => {
  const code = ensurePreviewRuntimePrecedesGlobals(
    'const { Channel } = __STORYBOOK_MODULE_CHANNELS__;',
    '/proj/src/preview.ts',
    '/storybook/dist/core/preview/runtime.js'
  );

  expect(code).toContain('/storybook/dist/core/preview/runtime.js');
  expect(code.indexOf('__sbInitializePreviewGlobals();')).toBeLessThan(
    code.indexOf('__STORYBOOK_MODULE_CHANNELS__')
  );
});

it('does not import the runtime from the bundled preview runtime', () => {
  const code = 'const { Channel } = __STORYBOOK_MODULE_CHANNELS__;';
  expect(
    ensurePreviewRuntimePrecedesGlobals(
      code,
      '/pkg/dist/core/preview/_chunks/runtime-abc.js',
      '/pkg/dist/core/preview/runtime.js'
    )
  ).toBe(code);
  expect(
    ensurePreviewRuntimePrecedesGlobals(
      code,
      'C:\\pkg\\dist\\core\\preview\\_chunks\\runtime-abc.js?v=1',
      'C:/pkg/dist/core/preview/runtime.js'
    )
  ).toBe(code);
});

it('rewriteImport', () => {
  cases.forEach(({ input, output, globals: caseGlobals, packageName: casePackage }) => {
    expect(rewriteImport(input, caseGlobals, casePackage)).toStrictEqual(output);
  });
});
