import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { logger } from 'storybook/internal/node-logger';

import type { Compiler } from 'webpack';

import { WebpackMockPlugin } from './webpack-mock-plugin.ts';

interface Resource {
  request: string;
  context: string;
  createData?: { resource?: string };
}

const files: Record<string, string> = {
  'project/package.json': JSON.stringify({ name: 'mock-plugin-project' }),
  'project/preview.js': [
    "import { sb } from 'storybook/test';",
    "sb.mock('./mocked-module');",
    "sb.mock('./mocked-dir');",
  ].join('\n'),
  'project/mocked-module.js': "export const value = 'real';",
  'project/__mocks__/mocked-module.js': "export const value = 'mocked';",
  'project/mocked-dir/index.js': "export const value = 'real';",
  'project/mocked-dir/__mocks__/index.js': "export const value = 'mocked';",
};

const slash = (path: string) => path.replaceAll('\\', '/');

let root: string;
let project: string;

beforeAll(() => {
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

/** Applies the plugin to a stub compiler and returns its replacement callback. */
function applyPlugin() {
  let replace: ((resource: Resource) => void) | undefined;
  let updateMocks: (() => void) | undefined;
  const compiler = {
    context: project,
    inputFileSystem: { statSync: () => ({ mtime: new Date(1000) }) },
    hooks: {
      beforeRun: { tap: (_name: string, fn: () => void) => (updateMocks = fn) },
      watchRun: { tap: () => {} },
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
  return (resource: Resource) => {
    replace!(resource);
    return slash(resource.request);
  };
}

// The mock map holds paths with `/`, while `require.resolve` returns paths with `\` on Windows,
// so local mocks don't match there yet.
const isWindows = process.platform === 'win32';

describe('WebpackMockPlugin', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  it.skipIf(isWindows)('replaces requests that resolve to a mocked module', () => {
    const replace = applyPlugin();
    const mock = slash(join(project, '__mocks__/mocked-module.js'));
    const linkedProject = join(root, 'app/node_modules/mock-plugin-project');

    expect(replace({ request: './mocked-module', context: project })).toBe(mock);
    expect(replace({ request: './mocked-module.js', context: project })).toBe(mock);
    expect(replace({ request: './mocked-dir', context: project })).toBe(
      slash(join(project, 'mocked-dir/__mocks__/index.js'))
    );
    expect(
      replace({ request: 'mock-plugin-project/mocked-module', context: join(root, 'app') })
    ).toBe(mock);
    expect(replace({ request: './mocked-module', context: linkedProject })).toBe(mock);
    // `require.resolve` joins a request to its context before following symlinks.
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

  it('does not resolve requests that cannot resolve to a mocked module', () => {
    const replace = applyPlugin();

    expect(replace({ request: './not-a-module', context: project })).toBe('./not-a-module');
    expect(replace({ request: '@/not-a-module', context: project })).toBe('@/not-a-module');
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it.skipIf(isWindows)('replaces requests only before resolution', () => {
    const replace = applyPlugin();

    // Webpack calls the plugin before resolution with empty `createData`, and again after it.
    expect(replace({ request: './mocked-module', context: project, createData: {} })).toBe(
      slash(join(project, '__mocks__/mocked-module.js'))
    );
    expect(
      replace({
        request: './mocked-module',
        context: project,
        createData: { resource: join(project, 'mocked-module.js') },
      })
    ).toBe('./mocked-module');
  });
});
