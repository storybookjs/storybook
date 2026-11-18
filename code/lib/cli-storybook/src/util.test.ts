import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import { UpgradeStorybookConfigDirNotFoundError } from 'storybook/internal/server-errors';

import type { UpgradeOptions } from './upgrade.ts';
import {
  type CollectProjectsSuccessResult,
  findOutdatedStorybookPackageJsons,
  findStorybookProjects,
  getConfigDirsFromScripts,
  getOutdatedScanScope,
  getProjects,
  warnAboutOutdatedStorybookPackageJsons,
} from './util.ts';

let root: string;

const createFixture = (files: Record<string, string>) => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'storybook-find-projects-')));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
};

const posix = (path: string) => path.replace(/\\/g, '/');

const packageJson = (content: object) => JSON.stringify(content);

afterEach(() => {
  vi.restoreAllMocks();
  if (root) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('findStorybookProjects', () => {
  it('ignores .storybook directories inside node_modules, whatever the .gitignore says', async () => {
    createFixture({
      '.gitignore': '**/**/node_modules/\n',
      'packages/ui/.storybook/main.ts': 'export default {};',
      'node_modules/@nx/storybook/files/project-files/.storybook/main.ts': 'export default {};',
    });

    expect(await findStorybookProjects(root)).toEqual([
      join(root, 'packages/ui/.storybook').replace(/\\/g, '/'),
    ]);
  });
});

describe('findStorybookProjects in a git repository', () => {
  it('skips .storybook directories that git ignores', async () => {
    createFixture({
      '.gitignore': 'generated/\n',
      'packages/ui/.storybook/main.ts': 'export default {};',
      'generated/app/.storybook/main.ts': 'export default {};',
    });
    execFileSync('git', ['init', '-q'], { cwd: root });

    expect(await findStorybookProjects(root)).toEqual([
      join(root, 'packages/ui/.storybook').replace(/\\/g, '/'),
    ]);
  });

  it('skips .storybook directories that a submodule ignores', async () => {
    createFixture({
      'vendor/.gitignore': 'generated/\n',
      'vendor/.storybook/main.ts': 'export default {};',
      'vendor/generated/.storybook/main.ts': 'export default {};',
    });
    const vendor = join(root, 'vendor');
    execFileSync('git', ['init', '-q'], { cwd: vendor });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=test',
        '-c',
        'user.email=test@test',
        'commit',
        '-q',
        '--allow-empty',
        '-m',
        'x',
      ],
      { cwd: vendor }
    );
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['add', 'vendor'], { cwd: root, stdio: 'ignore' });

    expect(await findStorybookProjects(root)).toEqual([
      join(root, 'vendor/.storybook').replace(/\\/g, '/'),
    ]);
  });
});

describe('findStorybookProjects with a repository inside an ignored directory', () => {
  it('skips the .storybook directories of that repository', async () => {
    createFixture({
      '.gitignore': 'repros/\n',
      'packages/ui/.storybook/main.ts': 'export default {};',
      'repros/clone/.storybook/main.ts': 'export default {};',
    });
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['init', '-q'], { cwd: join(root, 'repros/clone') });

    expect(await findStorybookProjects(root)).toEqual([
      join(root, 'packages/ui/.storybook').replace(/\\/g, '/'),
    ]);
  });
});

describe('findStorybookProjects in a directory that git ignores', () => {
  it('still finds the project', async () => {
    createFixture({
      '.gitignore': 'repro/\n',
      'repro/app/.storybook/main.ts': 'export default {};',
    });
    execFileSync('git', ['init', '-q'], { cwd: root });

    const cwd = join(root, 'repro/app');
    expect(await findStorybookProjects(cwd)).toEqual([join(cwd, '.storybook').replace(/\\/g, '/')]);
  });
});

describe('getConfigDirsFromScripts', () => {
  it('reads -c and --config-dir from storybook commands', () => {
    expect(
      getConfigDirsFromScripts({
        dev: 'storybook dev -c ./storybook -p 6006',
        build: 'storybook build --config-dir=config/sb -o ./build',
        npx: 'NODE_OPTIONS=--max-old-space-size=8192 npx storybook@latest build --config-dir "sb"',
        bin: 'node_modules/.bin/storybook dev -c .',
        node: 'node --inspect node_modules/storybook/bin/index.cjs dev -c ./node',
        sb: 'sb dev -c ./short',
        testRunner: 'test-storybook -c ./runner',
        crossEnv: 'cross-env FOO=1 storybook dev --config-dir ./env',
        attached: 'storybook dev -c./attached',
        equals: 'storybook dev -c=./equals',
        spaces: 'storybook dev -c "my sb"',
      })
    ).toEqual([
      './storybook',
      'config/sb',
      'sb',
      '.',
      './node',
      './short',
      './runner',
      './env',
      './attached',
      './equals',
      'my sb',
    ]);
  });

  it('reads storybook commands that another command runs from a quoted argument', () => {
    expect(
      getConfigDirsFromScripts({
        concurrently: 'concurrently "storybook dev -c ./sb" "tsc -w"',
        startServerAndTest: "start-server-and-test 'storybook dev -c other' 6006 test",
      })
    ).toEqual(['./sb', 'other']);
  });

  it('only reads flags of the storybook command in a chain', () => {
    expect(
      getConfigDirsFromScripts({
        chained: 'tsc -c tsconfig.json && storybook build -c .sb',
        background: 'storybook dev -p 6006 & tsc -c tsconfig.json',
        other: 'playwright test -c playwright.config.ts',
        workspace: 'npm run --workspace @wordpress/storybook storybook:build',
        npmRun: 'npm run storybook -- -c ./forwarded',
        noFlag: 'storybook dev -p 6006',
        notAString: 42,
      })
    ).toEqual(['.sb']);
  });

  it('skips commands that run in another directory', () => {
    expect(
      getConfigDirsFromScripts({
        cd: 'cd docs && storybook dev -c config',
        yarnWorkspace: 'yarn workspace docs storybook dev -c config',
        pnpmDir: 'pnpm -C docs exec storybook dev -c config',
        npmPrefix: 'npm --prefix docs exec storybook dev -c config',
        filter: 'pnpm --filter docs exec storybook dev -c config',
        kept: 'storybook dev -c kept',
      })
    ).toEqual(['kept']);
  });
});

describe('findStorybookProjects with config directories named in package.json scripts', () => {
  it('finds config directories that are not called .storybook', async () => {
    createFixture({
      'package.json': packageJson({ workspaces: ['storybook', 'test/*'] }),
      'storybook/package.json': packageJson({ scripts: { dev: 'storybook dev -c . -p 50240' } }),
      'storybook/main.ts': 'export default {};',
      'test/storybook-playwright/package.json': packageJson({
        scripts: {
          dev: 'storybook dev -c ./storybook -p 50241',
          build: 'storybook build -c ./storybook/ -o ./build',
        },
      }),
      'test/storybook-playwright/storybook/main.ts': 'export default {};',
    });

    expect((await findStorybookProjects(root)).sort()).toEqual([
      posix(join(root, 'storybook')),
      posix(join(root, 'test/storybook-playwright/storybook')),
    ]);
  });

  it('lists a .storybook directory that scripts name with other spellings only once', async () => {
    createFixture({
      'package.json': packageJson({
        scripts: {
          a: 'storybook dev -c .storybook',
          b: 'storybook dev -c ./.storybook/',
          c: 'storybook build -c ./link',
        },
      }),
      '.storybook/main.js': 'export default {};',
    });
    symlinkSync(join(root, '.storybook'), join(root, 'link'), 'junction');

    expect(await findStorybookProjects(root)).toEqual([posix(join(root, '.storybook'))]);
  });

  it('skips named directories that the .storybook glob would skip, or that have no main config', async () => {
    createFixture({
      'repo/.gitignore': 'generated/\n',
      'repo/app/package.json': packageJson({
        scripts: {
          found: 'storybook dev -c sb',
          outside: 'storybook dev -c ../../outside/sb',
          ignored: 'storybook dev -c ../generated/sb',
          nodeModules: 'storybook dev -c ../node_modules/.cache/sb',
          missing: 'storybook dev -c missing',
          variable: 'storybook dev -c $CONFIG',
          noMain: 'storybook dev -c empty',
        },
      }),
      'repo/app/sb/main.ts': 'export default {};',
      'repo/app/empty/preview.ts': 'export default {};',
      'repo/generated/sb/main.ts': 'export default {};',
      'repo/node_modules/.cache/sb/main.ts': 'export default {};',
      'repo/node_modules/some-template/package.json': packageJson({
        scripts: { storybook: 'storybook dev -c sb' },
      }),
      'repo/node_modules/some-template/sb/main.ts': 'export default {};',
      'outside/sb/main.ts': 'export default {};',
    });
    const repo = join(root, 'repo');
    execFileSync('git', ['init', '-q'], { cwd: repo });

    expect(await findStorybookProjects(repo)).toEqual([posix(join(repo, 'app/sb'))]);
  });
});

describe('findOutdatedStorybookPackageJsons', () => {
  it('reports package.json files that only allow an older Storybook major', async () => {
    createFixture({
      'package.json': packageJson({ devDependencies: { typescript: '^5.0.0' } }),
      'package-lock.json': '{}',
      'storybook/package.json': packageJson({
        devDependencies: { storybook: '^11.0.0-beta.2', '@storybook/react-vite': '^11.0.0-beta.2' },
      }),
      'test/storybook-playwright/package.json': packageJson({
        devDependencies: {
          storybook: '^10.6.6',
          '@storybook/react-vite': '^10.6.6',
          '@wordpress/storybook': 'file:../../storybook',
        },
      }),
      'packages/addon/package.json': packageJson({
        peerDependencies: { storybook: '^10.0.0 || ^11.0.0-0' },
        devDependencies: { storybook: 'workspace:*', 'storybook-addon-tag-badges': '^3.1.0' },
      }),
      'packages/canary/package.json': packageJson({
        devDependencies: { storybook: '0.0.0-pr-123-sha-abcdef', '@storybook/mcp': '^0.2.0' },
      }),
      'packages/catalog/package.json': packageJson({ devDependencies: { storybook: 'catalog:' } }),
      'node_modules/storybook/package.json': packageJson({
        dependencies: { storybook: '^10.0.0' },
      }),
    });

    expect(await findOutdatedStorybookPackageJsons('11.0.0-beta.2', { cwd: root })).toEqual([
      {
        packageJsonPath: posix(join(root, 'test/storybook-playwright/package.json')),
        dependencies: ['storybook ^10.6.6', '@storybook/react-vite ^10.6.6'],
      },
    ]);
  });

  it('skips package.json files of other installs and the ones it is told to ignore', async () => {
    createFixture({
      'package.json': packageJson({ devDependencies: { storybook: '^11.0.0' } }),
      'yarn.lock': '',
      'apps/isolated/package.json': packageJson({ devDependencies: { storybook: '^10.0.0' } }),
      'apps/isolated/pnpm-lock.yaml': '',
      'apps/isolated/nested/package.json': packageJson({
        devDependencies: { storybook: '^10.0.0' },
      }),
      'other/package.json': packageJson({ devDependencies: { storybook: '~10.1.0' } }),
    });

    expect(await findOutdatedStorybookPackageJsons('11.0.0', { cwd: root })).toEqual([
      {
        packageJsonPath: posix(join(root, 'other/package.json')),
        dependencies: ['storybook ~10.1.0'],
      },
    ]);
    expect(
      await findOutdatedStorybookPackageJsons('11.0.0', {
        cwd: root,
        ignore: [join(root, 'other/package.json')],
      })
    ).toEqual([]);
  });
});

const project = (operationDir: string, packageJsonPaths: string[]) =>
  ({
    packageManager: {
      primaryPackageJson: { operationDir },
      packageJsonPaths,
    },
  }) as unknown as CollectProjectsSuccessResult;

describe('getOutdatedScanScope', () => {
  it('scans the installs of the upgraded projects, without the projects left out', () => {
    createFixture({
      'package.json': '{}',
      'package-lock.json': '{}',
      'apps/a/package.json': '{}',
      'apps/isolated/package.json': '{}',
      'apps/isolated/yarn.lock': '',
    });
    const shared = posix(join(root, 'package.json'));
    const a = project(posix(join(root, 'apps/a')), [
      posix(join(root, 'apps/a/package.json')),
      shared,
    ]);
    const b = project(posix(join(root, 'apps/b')), [
      posix(join(root, 'apps/b/package.json')),
      shared,
    ]);
    const isolated = project(posix(join(root, 'apps/isolated')), [
      posix(join(root, 'apps/isolated/package.json')),
    ]);

    expect(getOutdatedScanScope([a], [a, b, isolated])).toEqual({
      roots: [posix(root)],
      ignore: [
        posix(join(root, 'apps/b/package.json')),
        posix(join(root, 'apps/isolated/package.json')),
      ],
    });
    expect(getOutdatedScanScope([isolated], [a, b, isolated]).roots).toEqual([
      posix(join(root, 'apps/isolated')),
    ]);
  });
});

describe('warnAboutOutdatedStorybookPackageJsons', () => {
  it('names each package.json and the old ranges it still declares', async () => {
    createFixture({
      'package-lock.json': '{}',
      'test/storybook-playwright/package.json': packageJson({
        devDependencies: { storybook: '^10.6.6', '@storybook/react-vite': '^10.6.6' },
      }),
      'tools/eslint/package.json': packageJson({
        devDependencies: { 'eslint-plugin-storybook': '^10.6.3' },
      }),
    });
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const upgraded = project(posix(root), []);
    await warnAboutOutdatedStorybookPackageJsons('11.0.0-beta.2', [upgraded], [upgraded]);

    expect(warn).toHaveBeenCalledOnce();
    const message = stripVTControlCharacters(String(warn.mock.calls[0][0]));
    expect(message).toContain(
      'test/storybook-playwright/package.json: storybook ^10.6.6, @storybook/react-vite ^10.6.6'
    );
    expect(message).toContain('tools/eslint/package.json: eslint-plugin-storybook ^10.6.3');
  });

  it('never fails the upgrade', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const broken = { packageManager: {} } as unknown as CollectProjectsSuccessResult;

    await expect(
      warnAboutOutdatedStorybookPackageJsons('11.0.0', [broken], [broken])
    ).resolves.toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('getProjects', () => {
  it('asks for --config-dir instead of prompting when --yes finds no .storybook directory', async () => {
    createFixture({ 'storybook/main.ts': 'export default {};' });
    vi.spyOn(process, 'cwd').mockReturnValue(root);

    await expect(getProjects({ yes: true } as UpgradeOptions)).rejects.toThrow(
      UpgradeStorybookConfigDirNotFoundError
    );
  });
});
