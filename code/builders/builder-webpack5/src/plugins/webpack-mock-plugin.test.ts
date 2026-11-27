import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { logger } from 'storybook/internal/node-logger';

import { basename, dirname, join, normalize } from 'pathe';
import webpack from 'webpack';
import type { Configuration, NormalModule, Stats } from 'webpack';

import { WebpackMockPlugin } from './webpack-mock-plugin.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

// The plugin extracts mocks with Node's resolver, which reads the real disk, so memfs cannot host
// this fixture.
let root: string;
let project: string;
let linkedProject: string;

const files: Record<string, string> = {
  'package.json': JSON.stringify({ name: 'fixture' }),
  '.storybook/preview.js': [
    "import { sb } from 'storybook/test';",
    "sb.mock('../src/api.js');",
    "sb.mock('../src/utils/format.js');",
    "sb.mock('../src/components/Icon.tsx', { spy: true });",
    "sb.mock('ext-pkg');",
    "sb.mock('server-pkg');",
  ].join('\n'),
  '.storybook/preview-without-mocks.js': 'export default {};',
  '.storybook/preview-with-unresolvable-mock.js': [
    "import { sb } from 'storybook/test';",
    "sb.mock('../src/api.js');",
    "sb.mock('../src/data');",
  ].join('\n'),
  'src/index.js': [
    "import { api } from './api.js';",
    "import { format } from '@/utils/format';",
    "import { Button } from './components/Button';",
    "import { ext } from 'ext-pkg';",
    "import { server } from 'server-pkg';",
    "import { other } from './other.js';",
    'export default [api, format, Button, ext, server, other];',
  ].join('\n'),
  'src/index-without-server-pkg.js': [
    "import { api } from './api.js';",
    "import { ext } from 'ext-pkg';",
    'export default [api, ext];',
  ].join('\n'),
  'src/api.js': "export const api = 'REAL_API';",
  'src/data.json': '{}',
  'src/__mocks__/api.js':
    "import { helper } from './helper.js'; export const api = 'MOCKED_API_' + helper;",
  'src/__mocks__/helper.js': "export const helper = 'FROM_MOCKS_DIR';",
  'src/utils/format.js': "export const format = () => 'REAL_FORMAT' + 'NEEDS_PROJECT_LOADER';",
  'src/components/Button.tsx':
    "import { Icon } from './Icon'; export const Button = () => 'BUTTON' + Icon();",
  'src/components/Icon.tsx': "export const Icon = () => 'REAL_ICON';",
  'src/other.js': "export const other = 'OTHER';",
  'node_modules/ext-pkg/package.json': JSON.stringify({ name: 'ext-pkg', main: 'index.js' }),
  'node_modules/ext-pkg/index.js': "export const ext = 'REAL_EXT';",
  '__mocks__/ext-pkg.js': "export const ext = 'MOCKED_EXT_' + 'NEEDS_PROJECT_LOADER';",
  // Only Node's resolver can reach this package; webpack's browser conditions cannot.
  'node_modules/server-pkg/package.json': JSON.stringify({
    name: 'server-pkg',
    exports: { '.': { node: './index.js' } },
  }),
  'node_modules/server-pkg/index.js': "export const server = 'REAL_SERVER';",
  '__mocks__/server-pkg.js': "export const server = 'MOCKED_SERVER';",
  'project-loader.cjs':
    "module.exports = (source) => source.replace('NEEDS_PROJECT_LOADER', 'PROJECT_LOADER_RAN');",
  'automock-loader-stub.cjs': [
    'module.exports = function (source) {',
    "  return `${source}\\n// automocked with ${JSON.stringify(this.getOptions())}, after project loader: ${source.includes('PROJECT_LOADER_RAN')}`;",
    '};',
  ].join('\n'),
};

// Vitest starts its workers with `--conditions code`, so the real automock loader would import
// core's TypeScript sources when webpack loads it natively. The stub records the options instead.
const automockLoader = fileURLToPath(
  import.meta.resolve('@storybook/builder-webpack5/loaders/webpack-automock-loader')
);

beforeAll(() => {
  root = normalize(realpathSync(mkdtempSync(join(tmpdir(), 'webpack-mock-plugin-'))));
  project = join(root, 'project');
  linkedProject = join(root, 'linked');
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(project, file)), { recursive: true });
    writeFileSync(join(project, file), content);
  }
  symlinkSync(project, linkedProject, 'junction');
});

beforeEach(() => {
  vi.mocked(logger.info).mockImplementation(() => {});
  vi.mocked(logger.warn).mockImplementation(() => {});
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

interface CompileOptions {
  previewFile?: string;
  context?: string;
  config?: Partial<Configuration>;
}

async function compile({
  previewFile = '.storybook/preview.js',
  context = project,
  config = {},
}: CompileOptions = {}) {
  const outputPath = join(root, 'dist', `${basename(context)}-${previewFile.replace(/\W/g, '-')}`);
  const stats = await new Promise<Stats>((resolve, reject) =>
    webpack(
      {
        mode: 'development',
        devtool: false,
        context,
        entry: './src/index.js',
        output: { path: outputPath, filename: 'bundle.js' },
        module: {
          rules: [
            {
              test: /\.(js|tsx)$/,
              exclude: /node_modules/,
              loader: join(project, 'project-loader.cjs'),
            },
          ],
        },
        resolveLoader: { alias: { [automockLoader]: join(project, 'automock-loader-stub.cjs') } },
        plugins: [new WebpackMockPlugin({ previewConfigPath: join(context, previewFile) })],
        ...config,
        resolve: {
          extensions: ['.tsx', '.js'],
          alias: { '@': join(context, 'src') },
          ...config.resolve,
        },
      },
      (error, result) => (error || !result ? reject(error) : resolve(result))
    )
  );
  expect(stats.toString({ all: false, errors: true })).toBe('');
  const modules = [...stats.compilation.modules].filter(
    (module): module is NormalModule => 'resource' in module
  );
  return {
    bundle: readFileSync(join(outputPath, 'bundle.js'), 'utf-8'),
    sourceOf: (file: string) => {
      const module = modules.find(
        (candidate) => normalize(candidate.resource) === join(context, file)
      );
      expect(module, `module ${file}`).toBeDefined();
      return String(module!.originalSource()?.source());
    },
  };
}

describe('WebpackMockPlugin', () => {
  let build: Awaited<ReturnType<typeof compile>>;

  beforeAll(async () => {
    build = await compile();
  });

  it('replaces a relative mock with its __mocks__ file', () => {
    expect(build.bundle).toContain('MOCKED_API_');
    expect(build.bundle).not.toContain('REAL_API');
  });

  it("resolves the __mocks__ file's own imports from the __mocks__ directory", () => {
    expect(build.bundle).toContain('FROM_MOCKS_DIR');
  });

  it('automocks a module imported through an alias, after the project loaders', () => {
    expect(build.sourceOf('src/utils/format.js')).toContain(
      '// automocked with {"spy":"false"}, after project loader: true'
    );
  });

  it('automocks a .tsx module imported without an extension and passes the spy option', () => {
    expect(build.sourceOf('src/components/Icon.tsx')).toContain(
      '// automocked with {"spy":"true"}'
    );
  });

  it('replaces a bare specifier with its __mocks__ file and runs the project loaders on it', () => {
    expect(build.bundle).toContain('PROJECT_LOADER_RAN');
    expect(build.bundle).not.toContain('REAL_EXT');
    expect(build.sourceOf('__mocks__/ext-pkg.js')).toContain('MOCKED_EXT_');
  });

  it('replaces a package that webpack cannot resolve with its __mocks__ file', () => {
    expect(build.bundle).toContain('MOCKED_SERVER');
    expect(build.bundle).not.toContain('REAL_SERVER');
    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('server-pkg'));
  });

  it('leaves unmocked modules alone', () => {
    expect(build.bundle).toContain('OTHER');
    expect(build.sourceOf('src/other.js')).not.toContain('automocked');
  });

  it('applies relative mocks when webpack keeps symlinked paths', async () => {
    const { bundle } = await compile({
      context: linkedProject,
      config: { resolve: { symlinks: false } },
    });

    expect(bundle).toContain('MOCKED_API_');
    expect(bundle).not.toContain('REAL_API');
  });

  // Node resolves `../src/data` to `data.json`; webpack's configured extensions do not.
  it('warns about a mock that webpack cannot resolve and keeps the others', async () => {
    const { bundle } = await compile({
      previewFile: '.storybook/preview-with-unresolvable-mock.js',
      config: { entry: './src/index-without-server-pkg.js' },
    });

    expect(bundle).toContain('MOCKED_API_');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not resolve "../src/data"')
    );
  });

  it('changes nothing when the preview file has no mocks', async () => {
    const { bundle } = await compile({
      previewFile: '.storybook/preview-without-mocks.js',
      config: { entry: './src/index-without-server-pkg.js' },
    });

    expect(bundle).toContain('REAL_API');
    expect(bundle).toContain('REAL_EXT');
    expect(bundle).not.toContain('automocked');
  });
});
