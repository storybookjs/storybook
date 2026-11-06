import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';
import * as memfs from 'memfs';
import { vol } from 'memfs';
import { join, relative } from 'pathe';
import yml from 'yaml';

import { CODE_DIRECTORY, ROOT_DIRECTORY } from './constants.ts';
import { exec } from './exec.ts';
import {
  configurePnpmForVerdaccio,
  importYarnLockfile,
  installPnpm,
  isLinkedSandbox,
  linkMonorepoPackages,
  syncLinkedPackages,
} from './pnpm.ts';
import { getCodeWorkspaces } from './workspace.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('./exec.ts', () => ({ exec: vi.fn() }));
vi.mock('./workspace.ts', () => ({ getCodeWorkspaces: vi.fn() }));
vi.mock('execa', () => ({ execaCommand: vi.fn() }));

const SANDBOX = resolve('sandbox');
const PNPM = 'pnpm@10.34.9+sha512.abc';

beforeEach(async () => {
  vol.reset();
  vi.mocked(exec).mockReset();
  const fsp = await import('node:fs/promises');
  vi.mocked(fsp.readFile).mockImplementation(memfs.fs.promises.readFile as never);
  vi.mocked(fsp.writeFile).mockImplementation(memfs.fs.promises.writeFile as never);
  vi.mocked(fsp.access).mockImplementation(memfs.fs.promises.access as never);
  vi.mocked(fsp.rm).mockImplementation(memfs.fs.promises.rm as never);
  vi.mocked(execaCommand).mockResolvedValue({ stdout: '10.34.9\n' } as never);

  vol.mkdirSync(ROOT_DIRECTORY, { recursive: true });
  vol.writeFileSync(join(ROOT_DIRECTORY, 'package.json'), JSON.stringify({ packageManager: PNPM }));
  vol.mkdirSync(SANDBOX, { recursive: true });
});

const publishedSandbox = (yarnConfig: Record<string, unknown> = {}) => {
  vol.writeFileSync(
    `${SANDBOX}/package.json`,
    JSON.stringify({ name: 'before-storybook', packageManager: 'yarn@4.18.0' })
  );
  vol.writeFileSync(`${SANDBOX}/yarn.lock`, '"chalk@npm:^4":\n  version: 4.1.2\n');
  vol.writeFileSync(
    `${SANDBOX}/.yarnrc.yml`,
    yml.stringify({ nodeLinker: 'node-modules', npmMinimalAgeGate: '7d', ...yarnConfig })
  );
};

const readJson = (path: string) => JSON.parse(vol.readFileSync(path, 'utf-8') as string);
const readWorkspaceConfig = () =>
  yml.parse(vol.readFileSync(`${SANDBOX}/pnpm-workspace.yaml`, 'utf-8') as string);
const commands = () => vi.mocked(exec).mock.calls.map(([command]) => String(command));

const install = (key: Parameters<typeof installPnpm>[0]['key'] = 'react-vite/default-ts') =>
  installPnpm({ cwd: SANDBOX, dryRun: false, debug: false, key });

describe('installPnpm', () => {
  it('pins the monorepo pnpm in place of the published Yarn', async () => {
    publishedSandbox();

    await install();

    expect(readJson(`${SANDBOX}/package.json`).packageManager).toBe(PNPM);
  });

  it('makes the sandbox its own workspace root with a Yarn-like node_modules layout', async () => {
    publishedSandbox();

    await install();

    expect(readWorkspaceConfig()).toMatchObject({ packages: ['.'], nodeLinker: 'hoisted' });
  });

  it('keeps the 7-day age gate in force', async () => {
    publishedSandbox();

    await install();

    expect(readWorkspaceConfig().minimumReleaseAge).toBe(10080);
  });

  it('exempts the locally published Storybook packages from the gate, and only those', async () => {
    publishedSandbox();

    await install();

    expect(readWorkspaceConfig().minimumReleaseAgeExclude).toEqual(
      expect.arrayContaining([
        'storybook',
        '@storybook/*',
        'create-storybook',
        'sb',
        'vite-plugin-storybook-nextjs',
      ])
    );
    expect(readWorkspaceConfig().minimumReleaseAgeExclude).not.toContain('*');
  });

  it("carries a template's Yarn allowlist over to the pnpm exemptions", async () => {
    publishedSandbox({ npmPreapprovedPackages: ['next', '@next/*'] });

    await install();

    expect(readWorkspaceConfig().minimumReleaseAgeExclude).toEqual(
      expect.arrayContaining(['next', '@next/*', 'storybook'])
    );
  });

  it('exempts the template exemptions for dependencies that init adds', async () => {
    publishedSandbox();

    await install('angular-vite/default-ts');

    expect(readWorkspaceConfig().minimumReleaseAgeExclude).toContain(
      '@analogjs/vite-plugin-angular'
    );
  });

  it('allows lockfile updates on CI, where pnpm installs frozen by default', async () => {
    publishedSandbox();

    await install();

    expect(readWorkspaceConfig().frozenLockfile).toBe(false);
  });

  it('refuses a pnpm that would ignore the pinned version and drop the age gate', async () => {
    publishedSandbox();
    vi.mocked(execaCommand).mockResolvedValue({ stdout: '9.6.0\n' } as never);

    await expect(install()).rejects.toThrow(/need pnpm 10\.34\.9.*is 9\.6\.0/);
  });
});

describe('importYarnLockfile', () => {
  it('converts the published lockfile instead of resolving from scratch', async () => {
    publishedSandbox();

    await importYarnLockfile({ cwd: SANDBOX, dryRun: false, debug: false });

    expect(commands()).toEqual(['pnpm import']);
  });

  it('removes Yarn files, which would make the Storybook CLI pick Yarn', async () => {
    publishedSandbox();

    await importYarnLockfile({ cwd: SANDBOX, dryRun: false, debug: false });

    expect(vol.existsSync(`${SANDBOX}/yarn.lock`)).toBe(false);
    expect(vol.existsSync(`${SANDBOX}/.yarnrc.yml`)).toBe(false);
  });
});

describe('configurePnpmForVerdaccio', () => {
  it('sets the registry in .npmrc, where pnpm reads it', async () => {
    await configurePnpmForVerdaccio({ cwd: SANDBOX, dryRun: false, debug: false });

    expect(vol.readFileSync(`${SANDBOX}/.npmrc`, 'utf-8')).toBe(
      'registry=http://localhost:6001/\n'
    );
  });

  it('drops cached local-registry metadata of the republished Storybook packages', async () => {
    await configurePnpmForVerdaccio({ cwd: SANDBOX, dryRun: false, debug: false });

    const [[purge]] = vi.mocked(exec).mock.calls;
    expect(purge).toEqual([
      expect.stringMatching(
        /^pnpm cache delete --registry=http:\/\/localhost:6001\/ .*'@storybook\/\*'/
      ),
      expect.stringMatching(
        /^pnpm cache delete --registry=http:\/\/localhost:6001\/ --config\.resolution-mode=time-based .*'@storybook\/\*'/
      ),
    ]);
  });
});

describe('linkMonorepoPackages', () => {
  beforeEach(() => {
    vi.mocked(getCodeWorkspaces).mockResolvedValue([
      { name: 'storybook', location: 'core' },
      { name: '@storybook/react', location: 'renderers/react' },
    ]);
    for (const [name, location] of [
      ['storybook', 'core'],
      ['@storybook/react', 'renderers/react'],
    ]) {
      vol.mkdirSync(join(CODE_DIRECTORY, location), { recursive: true });
      vol.writeFileSync(
        join(CODE_DIRECTORY, location, 'package.json'),
        JSON.stringify({ name, version: '11.0.0-beta.0' })
      );
    }
    vol.writeFileSync(
      `${SANDBOX}/package.json`,
      JSON.stringify({ devDependencies: { vite: '^8.0.0' } })
    );
  });

  it('installs each monorepo package from its code directory', async () => {
    await linkMonorepoPackages({ cwd: SANDBOX, dryRun: false, debug: false });

    const { resolutions } = readJson(`${SANDBOX}/package.json`);
    expect(resolutions.storybook).toMatch(/^file:.*code\/core$/);
    expect(resolutions['@storybook/react']).toMatch(/^file:.*code\/renderers\/react$/);
    expect(await isLinkedSandbox(SANDBOX)).toBe(true);
  });

  it('rewrites the workspace: peer ranges of the linked manifests', async () => {
    await linkMonorepoPackages({ cwd: SANDBOX, dryRun: false, debug: false });

    expect(readWorkspaceConfig().pnpmfile).toMatch(
      /scripts\/utils\/workspace-peers\.pnpmfile\.cjs$/
    );
  });

  it('is not a linked sandbox when installing from a registry', async () => {
    expect(await isLinkedSandbox(SANDBOX)).toBe(false);
  });
});

describe('syncLinkedPackages', () => {
  it('removes the installed linked packages, so the install links the current build', async () => {
    vol.writeFileSync(
      `${SANDBOX}/package.json`,
      JSON.stringify({
        resolutions: {
          storybook: `file:${relative(SANDBOX, join(CODE_DIRECTORY, 'core'))}`,
          react: '^19.0.0',
          'local-fork': 'file:../vendor/local-fork',
        },
      })
    );
    for (const name of ['storybook', 'react', 'local-fork']) {
      vol.mkdirSync(`${SANDBOX}/node_modules/${name}/dist`, { recursive: true });
    }

    await syncLinkedPackages({ cwd: SANDBOX, dryRun: false, debug: false });

    expect(vol.existsSync(`${SANDBOX}/node_modules/storybook`)).toBe(false);
    expect(vol.existsSync(`${SANDBOX}/node_modules/react`)).toBe(true);
    expect(vol.existsSync(`${SANDBOX}/node_modules/local-fork`)).toBe(true);
    expect(commands()).toEqual(['pnpm install --prefer-offline']);
  });
});
