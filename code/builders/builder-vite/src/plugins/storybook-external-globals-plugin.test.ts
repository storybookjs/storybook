import type { Options } from 'storybook/internal/types';

import { expect, it, vi } from 'vitest';

import type { Plugin } from 'vite';

vi.mock('storybook/internal/preview/globals', { spy: true });

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

const optimizedChunk = `
var require_client_logger = __commonJS({
  "node_modules/.cache/sb-vite-plugin-externals/client-logger.js"(exports, module) {
    module.exports = __STORYBOOK_MODULE_CLIENT_LOGGER__;
  }
});
var import_client_logger = __toESM(require_client_logger(), 1);
`;

const transform = async (mode: 'dev' | 'build', code: string, id: string) => {
  const options = { presets: { apply: async () => undefined } } as unknown as Options;
  const { transform: hook } = (await storybookExternalGlobalsPlugin(options)) as Plugin;
  const { filter, handler } = hook as Extract<typeof hook, { handler: unknown }>;
  const { include } = filter!.code as { include: string[] };

  return include.some((pattern) => code.includes(pattern))
    ? handler.call({ environment: { mode } } as ThisParameterType<typeof handler>, code, id)
    : undefined;
};

it('calls preview setup in a dev module that reads a global through an inlined alias', async () => {
  const result = await transform('dev', optimizedChunk, '/proj/node_modules/.vite/deps/chunk.js');
  const code = typeof result === 'string' ? result : result?.code;

  expect(code?.indexOf('__sbInitializePreviewGlobals();')).toBeLessThan(
    code!.indexOf('__STORYBOOK_MODULE_CLIENT_LOGGER__')
  );
  expect(code).toContain(optimizedChunk);
});

it('leaves a module that only reads a global unchanged in builds', async () => {
  const result = await transform('build', optimizedChunk, '/proj/src/chunk.js');

  expect(typeof result === 'string' ? result : result?.code).toBe(optimizedChunk);
});

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
  const code =
    "import { fn } from 'storybook/test';\nexport const Primary = () => <button>Hi</button>;";

  await expect(transform('dev', code, '/src/Button.stories.js')).resolves.toBeUndefined();
});

it('rewriteImport', () => {
  cases.forEach(({ input, output, globals: caseGlobals, packageName: casePackage }) => {
    expect(rewriteImport(input, caseGlobals, casePackage)).toStrictEqual(output);
  });
});
