import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { UpgradeStorybookConfigDirNotFoundError } from 'storybook/internal/server-errors';

import type { UpgradeOptions } from './upgrade.ts';
import {
  findOutdatedStorybookPackageJsons,
  findStorybookProjects,
  getConfigDirsFromScripts,
  getProjects,
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

describe('getConfigDirsFromScripts', () => {
  it('reads -c and --config-dir from storybook commands', () => {
    expect(
      getConfigDirsFromScripts({
        dev: 'storybook dev -c ./storybook -p 6006',
        build: 'storybook build --config-dir=config/sb -o ./build',
        quoted:
          'NODE_OPTIONS=--max-old-space-size=8192 npx storybook@latest build --config-dir "sb"',
        bin: 'node_modules/.bin/storybook dev -c .',
      })
    ).toEqual(['./storybook', 'config/sb', 'sb', '.']);
  });

  it('only reads flags of the storybook command in a chain', () => {
    expect(
      getConfigDirsFromScripts({
        chained: 'tsc -c tsconfig.json && storybook build -c .sb',
        other: 'playwright test -c playwright.config.ts',
        workspace: 'npm run --workspace @wordpress/storybook storybook:build',
        noFlag: 'storybook dev -p 6006',
        notAString: 42,
      })
    ).toEqual(['.sb']);
  });
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

  it('lists a .storybook directory that a script also names only once', async () => {
    createFixture({
      'package.json': packageJson({ scripts: { storybook: 'storybook dev -c .storybook' } }),
      '.storybook/main.js': 'export default {};',
    });

    expect(await findStorybookProjects(root)).toEqual([posix(join(root, '.storybook'))]);
  });

  it('skips named directories without a main config and package.json files in node_modules', async () => {
    createFixture({
      'package.json': packageJson({
        scripts: {
          a: 'storybook dev -c missing',
          b: 'storybook dev -c $CONFIG',
          c: 'storybook dev -c empty',
        },
      }),
      'empty/preview.ts': 'export default {};',
      'node_modules/some-template/package.json': packageJson({
        scripts: { storybook: 'storybook dev -c sb' },
      }),
      'node_modules/some-template/sb/main.ts': 'export default {};',
    });

    expect(await findStorybookProjects(root)).toEqual([]);
  });
});

describe('findOutdatedStorybookPackageJsons', () => {
  it('reports package.json files that only allow an older Storybook major', async () => {
    createFixture({
      'package.json': packageJson({ devDependencies: { typescript: '^5.0.0' } }),
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
      'packages/catalog/package.json': packageJson({ devDependencies: { storybook: 'catalog:' } }),
      'node_modules/storybook/package.json': packageJson({
        dependencies: { storybook: '^10.0.0' },
      }),
    });

    expect(await findOutdatedStorybookPackageJsons('11.0.0-beta.2', { cwd: root })).toEqual([
      {
        packageJsonPath: posix(join(root, 'test/storybook-playwright/package.json')),
        dependencies: ['storybook@^10.6.6', '@storybook/react-vite@^10.6.6'],
      },
    ]);
  });

  it('skips the package.json files it is told to ignore', async () => {
    createFixture({
      'other/package.json': packageJson({ devDependencies: { storybook: '~10.1.0' } }),
    });

    expect(await findOutdatedStorybookPackageJsons('11.0.0', { cwd: root })).toHaveLength(1);
    expect(
      await findOutdatedStorybookPackageJsons('11.0.0', {
        cwd: root,
        ignore: [join(root, 'other/package.json')],
      })
    ).toEqual([]);
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
