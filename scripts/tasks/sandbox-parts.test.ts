import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

import { vol } from 'memfs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { isStringLiteral, parseModule, walk } from '../../code/core/src/csf-tools/estree/ast.ts';
import type { PassedOptionValues, TemplateDetails } from '../task.ts';
import { extendPreview } from './sandbox-parts.ts';

// Spy-only mocks: keep the real module shapes, then redirect the reads and writes that
// `extendPreview` performs on the sandbox's preview config to `memfs`.
vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });

const SANDBOX_DIR = '/sandbox';
const PREVIEW_PATH = `${SANDBOX_DIR}/.storybook/preview.ts`;

const reactViteTemplate = {
  expected: {
    framework: '@storybook/react-vite',
    renderer: '@storybook/react',
    builder: '@storybook/builder-vite',
  },
  modifications: {},
} as TemplateDetails['template'];

/** Reads the emitted preview back as the set of modules it asks Storybook to mock. */
function mockedModules(source: string) {
  const mocks: { module: string; spy: boolean }[] = [];

  walk(parseModule(source).program, (node) => {
    const isSbMock =
      node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      node.callee.object.type === 'Identifier' &&
      node.callee.object.name === 'sb' &&
      node.callee.property.type === 'Identifier' &&
      node.callee.property.name === 'mock';

    if (!isSbMock) {
      return;
    }

    const [target, options] = node.arguments;
    // `sb.mock('./path')` for local files, `sb.mock(import('pkg'))` for packages.
    const specifier = target?.type === 'ImportExpression' ? target.source : target;

    mocks.push({
      module: isStringLiteral(specifier) ? specifier.value : `<unresolved>`,
      spy:
        options?.type === 'ObjectExpression' &&
        options.properties.some(
          (property) =>
            property.type === 'Property' &&
            property.key.type === 'Identifier' &&
            property.key.name === 'spy' &&
            property.value.type === 'Literal' &&
            property.value.value === true
        ),
    });
  });

  return mocks;
}

beforeEach(async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');

  vi.mocked(existsSync).mockImplementation(memfs.fs.existsSync);
  vi.mocked(readFile).mockImplementation(memfs.fs.promises.readFile as unknown as typeof readFile);
  vi.mocked(writeFile).mockImplementation(
    memfs.fs.promises.writeFile as unknown as typeof writeFile
  );
});

afterEach(() => {
  vol.reset();
});

// Regression: the mock calls used to be spliced into the *printed* preview source by matching a
// double-quoted `import { sb } from "storybook/test";` line. Once config printing started
// inferring quote style from the file, a single-quoted preview printed a single-quoted import, the
// match silently failed, and every sandbox was generated without module mocks.
it('mocks the module-mocking template modules in a single-quoted preview config', async () => {
  vol.fromNestedJSON({
    [PREVIEW_PATH]: `import type { Preview } from '@storybook/react-vite';

const preview: Preview = {
  parameters: {},
};

export default preview;
`,
  });

  await extendPreview(
    { template: reactViteTemplate, sandboxDir: SANDBOX_DIR } as TemplateDetails,
    {} as PassedOptionValues
  );

  const preview = (await readFile(PREVIEW_PATH, 'utf-8')) as string;

  expect(mockedModules(preview)).toEqual([
    { module: '../template-stories/core/test/ModuleMocking.utils.ts', spy: false },
    { module: '../template-stories/core/test/ModuleSpyMocking.utils.ts', spy: true },
    { module: '../template-stories/core/test/ModuleAutoMocking.utils.ts', spy: false },
    { module: '../template-stories/core/test/ClearModuleMocksMocking.api.ts', spy: true },
    { module: 'lodash-es', spy: false },
    { module: 'lodash-es/add', spy: false },
    { module: 'lodash-es/sum', spy: false },
    { module: 'uuid', spy: false },
  ]);
});
