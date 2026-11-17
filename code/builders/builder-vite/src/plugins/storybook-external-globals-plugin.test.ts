import { expect, it, vi } from 'vitest';

vi.mock('storybook/internal/preview/globals', { spy: true });

import type { Options } from 'storybook/internal/types';

import {
  ensurePreviewRuntimePrecedesGlobals,
  rewriteImport,
  storybookExternalGlobalsPlugin,
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
];

it('calls preview setup before a rewritten global', () => {
  const code = ensurePreviewRuntimePrecedesGlobals(
    'const { Channel } = __STORYBOOK_MODULE_CHANNELS__;',
    '/proj/src/preview.ts'
  );

  expect(code).toContain('dist/preview/runtime.js');
  expect(code.indexOf('__sbInitializePreviewGlobals();')).toBeLessThan(
    code.indexOf('__STORYBOOK_MODULE_CHANNELS__')
  );
});

it('does not import the runtime from the bundled preview runtime', () => {
  const code = 'const { Channel } = __STORYBOOK_MODULE_CHANNELS__;';
  expect(
    ensurePreviewRuntimePrecedesGlobals(code, '/pkg/dist/preview/_chunks/runtime-abc.js')
  ).toBe(code);
  expect(
    ensurePreviewRuntimePrecedesGlobals(code, 'C:\\pkg\\dist\\preview\\_chunks\\runtime-abc.js?v=1')
  ).toBe(code);
});

it('leaves code it cannot parse to the plugins that report syntax errors', async () => {
  const plugin = await storybookExternalGlobalsPlugin({
    presets: { apply: async () => ({}) },
  } as unknown as Options);
  const code =
    "import { fn } from 'storybook/test';\nexport const Primary = () => <button>Hi</button>;";

  const transform = plugin.transform as { handler: (code: string, id: string) => unknown };
  await expect(transform.handler(code, '/src/Button.stories.js')).resolves.toBeUndefined();
});

it('rewriteImport', () => {
  cases.forEach(({ input, output, globals: caseGlobals, packageName: casePackage }) => {
    expect(rewriteImport(input, caseGlobals, casePackage)).toStrictEqual(output);
  });
});
