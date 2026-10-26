import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

import { vol } from 'memfs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { isStringLiteral, parseModule, walk } from '../../code/core/src/csf-tools/estree/ast.ts';
import type { PassedOptionValues, TemplateDetails } from '../task.ts';
import { extendPreview, rewriteExpoTsconfigExtends } from './sandbox-parts.ts';

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

const angularViteTemplate = {
  expected: {
    framework: '@storybook/angular-vite',
    renderer: '@storybook/angular-vite',
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

it('wires Compodoc into an Angular Vite preview that opts out of server docgen', async () => {
  vol.fromNestedJSON({
    [PREVIEW_PATH]: `export default {};\n`,
    [`${SANDBOX_DIR}/.storybook/main.ts`]: `export default {
  features: { docgenServer: false },
};
`,
  });

  await extendPreview(
    { template: angularViteTemplate, sandboxDir: SANDBOX_DIR } as TemplateDetails,
    {} as PassedOptionValues
  );

  expect(await readFile(PREVIEW_PATH, 'utf-8')).toMatchInlineSnapshot(`
    "import { setCompodocJson } from \"@storybook/addon-docs/angular\";
    import docJson from \"../documentation.json\";
    import { sb } from \"storybook/test\";
    sb.mock('../template-stories/core/test/ModuleMocking.utils.ts');
    sb.mock('../template-stories/core/test/ModuleSpyMocking.utils.ts', { spy: true });
    sb.mock('../template-stories/core/test/ModuleAutoMocking.utils.ts');
    sb.mock('../template-stories/core/test/ClearModuleMocksMocking.api.ts', { spy: true });
    sb.mock(import('lodash-es'));
    sb.mock(import('lodash-es/add'));
    sb.mock(import('lodash-es/sum'));
    sb.mock(import('uuid'));
    export default { tags: [\"vitest\"] };
    setCompodocJson(docJson);
    "
  `);
});

it('imports the Vue template preview of a CSF factory sandbox', async () => {
  vol.fromNestedJSON({
    [PREVIEW_PATH]: `export default {};\n`,
    [`${SANDBOX_DIR}/src/stories/renderers/vue3_vue3-vite-prerelease-ts/preview.ts`]: ``,
  });

  await extendPreview(
    {
      key: 'vue3-vite/prerelease-ts',
      template: {
        expected: {
          framework: '@storybook/vue3-vite',
          renderer: '@storybook/vue3',
          builder: '@storybook/builder-vite',
        },
        modifications: { useCsfFactory: true, skipMocking: true },
      },
      sandboxDir: SANDBOX_DIR,
    } as TemplateDetails,
    {} as PassedOptionValues
  );

  expect(await readFile(PREVIEW_PATH, 'utf-8')).toContain(
    'import "../src/stories/renderers/vue3_vue3-vite-prerelease-ts/preview";'
  );
});

const expoTsconfig = `{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
`;

describe('rewriteExpoTsconfigExtends', () => {
  it('rewrites the package-style extends when the specifier fails to resolve and the direct file exists', () => {
    const result = rewriteExpoTsconfigExtends(expoTsconfig, {
      extensionlessResolves: false,
      directPathExists: true,
    });

    expect(result).toContain('"extends": "./node_modules/expo/tsconfig.base.json"');
    expect(result).toContain('"@/*"');
  });

  it('keeps the user-shaped tsconfig when the specifier resolves', () => {
    expect(
      rewriteExpoTsconfigExtends(expoTsconfig, {
        extensionlessResolves: true,
        directPathExists: true,
      })
    ).toBeNull();
  });

  it('keeps the tsconfig when expo did not ship the direct json file', () => {
    expect(
      rewriteExpoTsconfigExtends(expoTsconfig, {
        extensionlessResolves: false,
        directPathExists: false,
      })
    ).toBeNull();
  });

  it('ignores tsconfigs that do not extend the expo base config', () => {
    expect(
      rewriteExpoTsconfigExtends(`{ "extends": "@react-native/typescript-config/tsconfig.json" }`, {
        extensionlessResolves: false,
        directPathExists: true,
      })
    ).toBeNull();
  });

  it('ignores malformed tsconfig content', () => {
    expect(
      rewriteExpoTsconfigExtends('not json', {
        extensionlessResolves: false,
        directPathExists: true,
      })
    ).toBeNull();
  });
});
