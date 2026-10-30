import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { logger } from 'storybook/internal/node-logger';

import { normalize } from 'pathe';
import webpack from 'webpack';
import type { Configuration, NormalModule, Stats, WebpackPluginInstance } from 'webpack';

import { WebpackMockPlugin } from './webpack-mock-plugin.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

// The plugin extracts mocks with Node's resolver, which reads the real disk, so memfs cannot host
// this fixture.
let root: string;

const files: Record<string, string> = {
  'package.json': JSON.stringify({ name: 'fixture' }),
  '.storybook/preview.js': [
    "import { sb } from 'storybook/test';",
    "sb.mock('../src/api.js');",
    "sb.mock('../src/utils/format.js');",
    "sb.mock('../src/components/Icon.tsx', { spy: true });",
    "sb.mock('ext-pkg');",
  ].join('\n'),
  '.storybook/preview-without-mocks.js': 'export default {};',
  'src/index.js': [
    "import { api } from './api.js';",
    "import { format } from '@/utils/format';",
    "import { Button } from './components/Button';",
    "import { ext } from 'ext-pkg';",
    "import { other } from './other.js';",
    'export default [api, format, Button, ext, other];',
  ].join('\n'),
  'src/api.js': "export const api = 'REAL_API';",
  'src/__mocks__/api.js':
    "import { helper } from './helper.js'; export const api = 'MOCKED_API_' + helper;",
  'src/__mocks__/helper.js': "export const helper = 'FROM_MOCKS_DIR';",
  'src/utils/format.js': "export const format = () => 'REAL_FORMAT';",
  'src/components/Button.tsx':
    "import { Icon } from './Icon'; export const Button = () => 'BUTTON' + Icon();",
  'src/components/Icon.tsx': "export const Icon = () => 'REAL_ICON';",
  'src/other.js': "export const other = 'OTHER';",
  'node_modules/ext-pkg/package.json': JSON.stringify({ name: 'ext-pkg', main: 'index.js' }),
  'node_modules/ext-pkg/index.js': "export const ext = 'REAL_EXT';",
  '__mocks__/ext-pkg.js': "export const ext = 'MOCKED_EXT_' + 'NEEDS_PROJECT_LOADER';",
  'project-loader.cjs':
    "module.exports = (source) => source.replace('NEEDS_PROJECT_LOADER', 'PROJECT_LOADER_RAN');",
  'automock-loader-stub.cjs':
    'module.exports = function (source) { return `${source}\\n// automocked with ${JSON.stringify(this.getOptions())}`; };',
};

// Vitest starts its workers with `--conditions code`, so the real automock loader would import
// core's TypeScript sources when webpack loads it natively. The stub records the options instead.
const automockLoader = fileURLToPath(
  import.meta.resolve('@storybook/builder-webpack5/loaders/webpack-automock-loader')
);
const stubAutomockLoader: WebpackPluginInstance = {
  apply(compiler) {
    compiler.hooks.compilation.tap('stub-automock-loader', (compilation) => {
      webpack.NormalModule.getCompilationHooks(compilation).beforeLoaders.tap(
        'stub-automock-loader',
        (loaders) => {
          for (const item of loaders) {
            if (item.loader === automockLoader) {
              item.loader = join(root, 'automock-loader-stub.cjs');
            }
          }
        }
      );
    });
  },
};

beforeAll(() => {
  vi.mocked(logger.info).mockImplementation(() => {});
  root = realpathSync(mkdtempSync(join(tmpdir(), 'webpack-mock-plugin-')));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

async function compile(previewFile = '.storybook/preview.js') {
  const outputPath = join(root, 'dist', previewFile.replace(/\W/g, '-'));
  const config: Configuration = {
    mode: 'development',
    devtool: false,
    context: root,
    entry: './src/index.js',
    output: { path: outputPath, filename: 'bundle.js' },
    resolve: { extensions: ['.tsx', '.js'], alias: { '@': join(root, 'src') } },
    module: {
      rules: [
        { test: /\.(js|tsx)$/, exclude: /node_modules/, loader: join(root, 'project-loader.cjs') },
      ],
    },
    plugins: [
      new WebpackMockPlugin({ previewConfigPath: join(root, previewFile) }),
      stubAutomockLoader,
    ],
  };
  const stats = await new Promise<Stats>((resolve, reject) =>
    webpack(config, (error, result) => (error || !result ? reject(error) : resolve(result)))
  );
  expect(stats.toString({ all: false, errors: true })).toBe('');
  const modules = [...stats.compilation.modules].filter(
    (module): module is NormalModule => 'resource' in module
  );
  return {
    bundle: readFileSync(join(outputPath, 'bundle.js'), 'utf-8'),
    moduleFor: (file: string) => {
      const module = modules.find(
        (candidate) => normalize(candidate.resource) === normalize(join(root, file))
      );
      expect(module, `module ${file}`).toBeDefined();
      return module!;
    },
  };
}

const loaderNames = (module: NormalModule) =>
  module.loaders.map((item) => `${item.loader.split('/').pop()}?${item.options}`);

describe('WebpackMockPlugin', () => {
  it('replaces a relative mock with its __mocks__ file', async () => {
    const { bundle } = await compile();

    expect(bundle).toContain('MOCKED_API_');
    expect(bundle).not.toContain('REAL_API');
  });

  it("resolves the __mocks__ file's own imports from the __mocks__ directory", async () => {
    const { bundle } = await compile();

    expect(bundle).toContain('FROM_MOCKS_DIR');
  });

  it('automocks a module imported through an alias, after the project loaders', async () => {
    const { moduleFor } = await compile();
    const module = moduleFor('src/utils/format.js');

    expect(loaderNames(module)).toEqual([
      'automock-loader-stub.cjs?spy=false',
      'project-loader.cjs?undefined',
    ]);
    expect(module.identifier()).toContain('webpack-automock-loader.js?spy=false!');
    expect(module.originalSource()?.source()).toContain('// automocked with {"spy":"false"}');
  });

  it('automocks a .tsx module imported without an extension and passes the spy option', async () => {
    const { moduleFor } = await compile();
    const module = moduleFor('src/components/Icon.tsx');

    expect(module.originalSource()?.source()).toContain('// automocked with {"spy":"true"}');
    expect(module.identifier()).toContain('webpack-automock-loader.js?spy=true!');
  });

  it('replaces a bare specifier with its __mocks__ file and runs the project loaders on it', async () => {
    const { bundle, moduleFor } = await compile();

    expect(bundle).toContain('PROJECT_LOADER_RAN');
    expect(bundle).not.toContain('REAL_EXT');
    expect(moduleFor('__mocks__/ext-pkg.js').identifier()).toContain('project-loader.cjs');
  });

  it('leaves unmocked modules alone', async () => {
    const { bundle, moduleFor } = await compile();

    expect(bundle).toContain('OTHER');
    expect(loaderNames(moduleFor('src/other.js'))).toEqual(['project-loader.cjs?undefined']);
  });

  it('changes nothing when the preview file has no mocks', async () => {
    const { bundle } = await compile('.storybook/preview-without-mocks.js');

    expect(bundle).toContain('REAL_API');
    expect(bundle).toContain('REAL_EXT');
    expect(bundle).not.toContain('webpack-automock-loader');
  });
});
