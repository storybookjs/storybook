import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import {
  getIsExternal,
  resolveExternalModule,
  resolveWithExtensions,
} from 'storybook/internal/mocking-utils';
import { logger } from 'storybook/internal/node-logger';

import { dirname, join, normalize } from 'pathe';
import type { Compiler } from 'webpack';

import { WebpackMockPlugin } from './webpack-mock-plugin.ts';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('storybook/internal/mocking-utils', { spy: true });

interface Resource {
  request: string;
  context: string;
  createData: { resource?: string };
}

const files: Record<string, string> = {
  'project/package.json': JSON.stringify({ name: 'mock-plugin-project' }),
  'project/preview.js': [
    "import { sb } from 'storybook/test';",
    "sb.mock('./mocked-module');",
    "sb.mock('./mocked-dir');",
    "sb.mock('ext-pkg');",
  ].join('\n'),
  'project/mocked-module.js': "export const value = 'real';",
  'project/__mocks__/mocked-module.js': "export const value = 'mocked';",
  'project/mocked-dir/index.js': "export const value = 'real';",
  'project/mocked-dir/__mocks__/index.js': "export const value = 'mocked';",
  'project/node_modules/ext-pkg/package.json': JSON.stringify({ name: 'ext-pkg' }),
  'project/node_modules/ext-pkg/index.js': "export const value = 'real';",
  'project/__mocks__/ext-pkg.js': "export const value = 'mocked';",
};

let root: string;
let project: string;

beforeAll(() => {
  // Node's require.resolve reads the real disk, so this fixture cannot live in memfs.
  root = realpathSync(mkdtempSync(join(tmpdir(), 'webpack-mock-plugin-')));
  project = join(root, 'project');
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  // `app` depends on the project through a link, like a workspace package.
  mkdirSync(join(root, 'app/node_modules'), { recursive: true });
  symlinkSync(project, join(root, 'app/node_modules/mock-plugin-project'), 'junction');
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function applyPlugin() {
  let replace: ((resource: Resource) => void) | undefined;
  let updateMocks: (() => void) | undefined;
  const compiler = {
    context: project,
    inputFileSystem: { statSync: () => ({ mtime: new Date(1000) }) },
    hooks: {
      beforeRun: { tap: (_name: string, fn: () => void) => (updateMocks = fn) },
      watchRun: { tap: (_name: string, fn: () => void) => (updateMocks = fn) },
      afterCompile: { tap: () => {} },
    },
    getInfrastructureLogger: () => ({ warn: vi.fn() }),
    webpack: {
      NormalModuleReplacementPlugin: class {
        constructor(_test: RegExp, callback: (resource: Resource) => void) {
          replace = callback;
        }
        apply() {}
      },
    },
  };
  new WebpackMockPlugin({ previewConfigPath: join(project, 'preview.js') }).apply(
    compiler as unknown as Compiler
  );
  updateMocks!();
  return {
    replace(resource: Omit<Resource, 'createData'> & { createData?: Resource['createData'] }) {
      const data = { createData: {}, ...resource };
      replace!(data);
      return normalize(data.request);
    },
    updateMocks: updateMocks!,
  };
}

// require.resolve uses backslashes on Windows, unlike the mock map's forward-slash paths.
const isWindows = process.platform === 'win32';

describe('WebpackMockPlugin', () => {
  beforeEach(() => {
    vi.mocked(logger.debug).mockImplementation(() => {});
    vi.mocked(logger.info).mockImplementation(() => {});
  });

  it.skipIf(isWindows)('replaces requests that resolve to a mocked module', () => {
    const { replace } = applyPlugin();
    const mock = join(project, '__mocks__/mocked-module.js');
    const linkedProject = join(root, 'app/node_modules/mock-plugin-project');

    expect(replace({ request: 'ext-pkg', context: project })).toBe(
      join(project, '__mocks__/ext-pkg.js')
    );
    expect(replace({ request: './mocked-module', context: project })).toBe(mock);
    expect(replace({ request: './mocked-module.js', context: project })).toBe(mock);
    expect(replace({ request: './mocked-dir', context: project })).toBe(
      join(project, 'mocked-dir/__mocks__/index.js')
    );
    expect(
      replace({ request: 'mock-plugin-project/mocked-module', context: join(root, 'app') })
    ).toBe(mock);
    expect(replace({ request: './mocked-module', context: linkedProject })).toBe(mock);
    expect(replace({ request: '../../../project/mocked-module', context: linkedProject })).toBe(
      mock
    );
    expect(replace({ request: join(linkedProject, 'mocked-module'), context: root })).toBe(mock);
    expect(
      replace({
        request: './node_modules/mock-plugin-project/mocked-module',
        context: join(root, 'app'),
      })
    ).toBe(mock);
  });

  it.skipIf(isWindows)('refreshes directory links when the preview is unchanged', () => {
    const { replace, updateMocks } = applyPlugin();
    const unmocked = join(root, 'unmocked');
    const relinked = join(root, 'relinked');
    mkdirSync(unmocked);
    symlinkSync(unmocked, relinked, 'junction');

    expect(replace({ request: './mocked-module', context: relinked })).toBe(
      normalize('./mocked-module')
    );

    rmSync(relinked);
    symlinkSync(project, relinked, 'junction');
    updateMocks();

    expect(replace({ request: './mocked-module', context: relinked })).toBe(
      join(project, '__mocks__/mocked-module.js')
    );
  });

  it('does not resolve requests that cannot resolve to a mocked module', () => {
    const { replace } = applyPlugin();

    vi.clearAllMocks();

    expect(replace({ request: './not-a-module', context: project })).toBe(
      normalize('./not-a-module')
    );
    expect(replace({ request: '@/not-a-module', context: project })).toBe('@/not-a-module');
    expect(replace({ request: 'react', context: project })).toBe('react');
    expect(getIsExternal).not.toHaveBeenCalled();
    expect(resolveWithExtensions).not.toHaveBeenCalled();
    expect(resolveExternalModule).not.toHaveBeenCalled();
  });

  it.skipIf(isWindows)('replaces requests only before resolution', () => {
    const { replace } = applyPlugin();

    expect(replace({ request: './mocked-module', context: project, createData: {} })).toBe(
      join(project, '__mocks__/mocked-module.js')
    );
    expect(
      replace({
        request: './mocked-module',
        context: project,
        createData: { resource: join(project, 'mocked-module.js') },
      })
    ).toBe(normalize('./mocked-module'));
  });
});
