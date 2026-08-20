import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadTools } from './loader.ts';

vi.mock('node:module', { spy: true });

// Real files on disk, not memfs: Node's resolver and dynamic import bypass a virtual filesystem.
const temporaryDirectories: string[] = [];

function createTemporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'storybook-tools-loader-'));
  temporaryDirectories.push(directory);
  return realpathSync(directory);
}

function writeToolsPackage(packageDir: string, entryFile: string, source: string) {
  const entryPath = join(packageDir, entryFile);
  mkdirSync(dirname(entryPath), { recursive: true });
  writeFileSync(
    join(packageDir, 'package.json'),
    JSON.stringify({
      name: 'storybook',
      version: '10.0.0',
      type: 'module',
      exports: { './internal/tools': `./${entryFile}` },
    })
  );
  writeFileSync(entryPath, source);
  return entryPath;
}

function namedExport(marker: string) {
  return `export const createTools = async (options) => ({ marker: '${marker}', options });`;
}

beforeEach(() => {
  vi.mocked(createRequire).mockReset();
});

afterEach(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { force: true, recursive: true });
  }
  temporaryDirectories.length = 0;
});

describe('loadTools', () => {
  it('loads the SDK an npm layout installed, not the copy this loader ships inside', async () => {
    const projectDir = createTemporaryDirectory();
    writeToolsPackage(
      join(projectDir, 'node_modules', 'storybook'),
      'dist/tools.js',
      namedExport('npm')
    );

    await expect(loadTools(projectDir)).resolves.toEqual({
      marker: 'npm',
      options: { cwd: projectDir },
    });
  });

  it('loads the SDK a pnpm layout linked into the project', async () => {
    const projectDir = createTemporaryDirectory();
    const storeDir = join(
      projectDir,
      'node_modules',
      '.pnpm',
      'storybook@10.0.0',
      'node_modules',
      'storybook'
    );
    writeToolsPackage(storeDir, 'dist/tools.js', namedExport('pnpm'));
    // 'junction' so the fixture also works on Windows, where dir symlinks need elevation.
    symlinkSync(storeDir, join(projectDir, 'node_modules', 'storybook'), 'junction');

    await expect(loadTools(projectDir)).resolves.toEqual({
      marker: 'pnpm',
      options: { cwd: projectDir },
    });
  });

  describe('a Yarn PnP project, where PnP owns resolution', () => {
    const resolve = vi.fn();

    beforeEach(() => {
      const entryPath = writeToolsPackage(
        join(createTemporaryDirectory(), 'node_modules', 'storybook-virtual'),
        'dist/tools.js',
        namedExport('pnp')
      );
      resolve.mockReset();
      resolve.mockReturnValue(entryPath);
      vi.mocked(createRequire).mockReturnValue({ resolve } as unknown as NodeRequire);
    });

    it('imports what PnP resolves, asking it from the project directory', async () => {
      const projectDir = createTemporaryDirectory();

      await expect(loadTools(projectDir)).resolves.toEqual({
        marker: 'pnp',
        options: { cwd: projectDir },
      });
      expect(createRequire).toHaveBeenCalledWith(join(projectDir, 'package.json'));
      expect(resolve).toHaveBeenCalledWith('storybook/internal/tools', { paths: [projectDir] });
    });
  });

  it('forwards every option, letting the caller override the project directory as cwd', async () => {
    const projectDir = createTemporaryDirectory();
    writeToolsPackage(
      join(projectDir, 'node_modules', 'storybook'),
      'dist/tools.js',
      namedExport('npm')
    );

    await expect(
      loadTools(projectDir, {
        cwd: join(projectDir, 'packages', 'app'),
        configDir: '.storybook',
        mode: 'local',
        clientInfo: { name: 'embedder', version: '1.2.3' },
      })
    ).resolves.toEqual({
      marker: 'npm',
      options: {
        cwd: join(projectDir, 'packages', 'app'),
        configDir: '.storybook',
        mode: 'local',
        clientInfo: { name: 'embedder', version: '1.2.3' },
      },
    });
  });

  it('reads createTools off a default export', async () => {
    const projectDir = createTemporaryDirectory();
    writeToolsPackage(
      join(projectDir, 'node_modules', 'storybook'),
      'dist/tools.js',
      `const createTools = async (options) => ({ marker: 'default', options });
       export default { createTools };`
    );

    await expect(loadTools(projectDir)).resolves.toEqual({
      marker: 'default',
      options: { cwd: projectDir },
    });
  });

  it('reads createTools off a CommonJS entry', async () => {
    const projectDir = createTemporaryDirectory();
    writeToolsPackage(
      join(projectDir, 'node_modules', 'storybook'),
      'dist/tools.cjs',
      `module.exports = { createTools: async (options) => ({ marker: 'cjs', options }) };`
    );

    await expect(loadTools(projectDir)).resolves.toEqual({
      marker: 'cjs',
      options: { cwd: projectDir },
    });
  });

  it('names the project directory when it has no Storybook installed', async () => {
    const projectDir = createTemporaryDirectory();

    const failure = loadTools(projectDir);

    await expect(failure).rejects.toThrow(
      `Could not resolve \`storybook/internal/tools\` from ${projectDir}`
    );
    await expect(failure).rejects.toMatchObject({
      cause: expect.objectContaining({ code: 'MODULE_NOT_FOUND' }),
    });
  });

  it('rejects an entry that exposes no createTools', async () => {
    const projectDir = createTemporaryDirectory();
    const entryPath = writeToolsPackage(
      join(projectDir, 'node_modules', 'storybook'),
      'dist/tools.js',
      `export const somethingElse = 1;`
    );

    await expect(loadTools(projectDir)).rejects.toThrow(
      `The \`storybook/internal/tools\` entry at ${entryPath} exposes no \`createTools\`.`
    );
  });
});
