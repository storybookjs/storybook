import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { loadTools } from './loader.ts';

// Real files on disk, not memfs: Node's resolver, dynamic import, and Yarn PnP bypass a virtual filesystem.
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

function findYarnRelease(from: string) {
  let current = from;
  for (;;) {
    const candidate = join(current, '.yarn', 'releases', 'yarn-4.18.0.cjs');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error('Could not find the Yarn 4.18.0 release used to build this fixture.');
    }
    current = parent;
  }
}

function createYarnPnpProject() {
  const projectDir = createTemporaryDirectory();
  writeToolsPackage(join(projectDir, 'vendor', 'storybook'), 'dist/tools.js', namedExport('pnp'));
  writeFileSync(
    join(projectDir, 'package.json'),
    JSON.stringify({
      name: 'pnp-tools-fixture',
      private: true,
      packageManager: 'yarn@4.18.0',
      dependencies: { storybook: 'portal:./vendor/storybook' },
    })
  );
  writeFileSync(join(projectDir, '.yarnrc.yml'), 'nodeLinker: pnp\nenableGlobalCache: false\n');
  execFileSync(process.execPath, [findYarnRelease(fileURLToPath(import.meta.url)), 'install'], {
    cwd: projectDir,
    encoding: 'utf8',
  });
  return projectDir;
}

function loadToolsInPlainNode(projectDir: string) {
  const loaderUrl = pathToFileURL(fileURLToPath(new URL('./loader.ts', import.meta.url))).href;
  const script = `
    import { loadTools } from ${JSON.stringify(loaderUrl)};
    process.stdout.write(JSON.stringify(await loadTools(${JSON.stringify(projectDir)})));
  `;
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  return JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
      encoding: 'utf8',
      env,
    })
  );
}

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

  it('loads the SDK from a relative project directory', async () => {
    const projectDir = createTemporaryDirectory();
    writeToolsPackage(
      join(projectDir, 'node_modules', 'storybook'),
      'dist/tools.js',
      namedExport('npm')
    );
    const relativeProjectDir = relative(process.cwd(), projectDir);
    expect(isAbsolute(relativeProjectDir)).toBe(false);

    await expect(loadTools(relativeProjectDir)).resolves.toEqual({
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

  it('loads the SDK a Yarn PnP project installed, from a plain Node process', () => {
    const projectDir = createYarnPnpProject();

    expect(loadToolsInPlainNode(projectDir)).toEqual({
      marker: 'pnp',
      options: { cwd: projectDir },
    });
  }, 60_000);

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
