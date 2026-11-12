import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as memfs from 'memfs';
import { vol } from 'memfs';
import { resolve } from 'pathe';
import yml from 'yaml';

import { packageManager as monorepoPackageManager } from '../../../package.json';
import { runCommand } from '../generate.ts';
import {
  BEFORE_SANDBOX_NPM_MIN_VERSION,
  LOCALLY_PUBLISHED_PACKAGE_PATTERNS,
  PUBLISHED_SANDBOX_PACKAGE_MANAGER,
  PUBLISHED_SANDBOX_USER_AGENT,
  ensureNpmSupportsMinReleaseAge,
  finishAfterStorybook,
  parsePnpmErrorRecords,
  preapproveLocallyPublishedPackages,
  refreshBeforeStorybookLockfile,
  writeScaffoldNpmrc,
} from './package-manager.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('../generate.ts', { spy: true });

const SANDBOX = resolve('sandbox');
const WORKSPACE = `${SANDBOX}/pnpm-workspace.yaml`;
const RESOLVE =
  'pnpm install --lockfile-only --registry=https://registry.npmjs.org/ --reporter=ndjson';

const readWorkspace = () => yml.parse(vol.readFileSync(WORKSPACE, 'utf-8') as string);
const readManifest = () =>
  JSON.parse(vol.readFileSync(`${SANDBOX}/package.json`, 'utf-8') as string);

const commands = () => vi.mocked(runCommand).mock.calls.map(([script]) => script);

/** A pnpm `--reporter=ndjson` line, as a failed resolution prints it on stdout. */
const errorLine = (record: Record<string, unknown>) =>
  JSON.stringify({
    time: 1794406294255,
    level: 'error',
    name: 'pnpm',
    prefix: SANDBOX,
    // pnpm attaches the whole registry document, which runs to tens of MB.
    packageMeta: { name: 'registry-document', readme: 'x'.repeat(100_000) },
    ...record,
  });

const gated = (name: string, version: string, pkgsStack: unknown[] = []) =>
  errorLine({
    code: 'ERR_PNPM_NO_MATURE_MATCHING_VERSION',
    pkgsStack,
    immatureVersion: version,
    package: { name, bareSpecifier: version, version },
    err: {
      name: 'pnpm',
      message: `Version ${version} (released 10 hours ago) of ${name} does not meet the minimumReleaseAge constraint`,
      code: 'ERR_PNPM_NO_MATURE_MATCHING_VERSION',
    },
  });

const PROGRESS = JSON.stringify({ level: 'debug', name: 'pnpm:progress', status: 'resolved' });

/** A failed pnpm run, shaped like the error execa rejects with. */
const failed = (...lines: string[]) =>
  Object.assign(new Error(`Command failed with exit code 1: ${RESOLVE}\n\n${lines.join('\n')}`), {
    shortMessage: `Command failed with exit code 1: ${RESOLVE}`,
    stdout: [PROGRESS, ...lines].join('\n'),
    stderr: '',
  });

const refreshError = () =>
  refreshBeforeStorybookLockfile({ cwd: SANDBOX }).then(
    () => {
      throw new Error('expected the refresh to fail');
    },
    (error: Error) => error
  );

/** Fail the next resolutions with the given errors, then succeed. */
const failResolutions = (...errors: Error[]) => {
  const queue = [...errors];
  vi.mocked(runCommand).mockImplementation((async (script: string) => {
    if (script === RESOLVE && queue.length) {
      throw queue.shift();
    }
    return { stdout: '' };
  }) as never);
};

beforeEach(async () => {
  vol.reset();
  const fsp = await import('node:fs/promises');
  vi.mocked(fsp.readFile).mockImplementation(memfs.fs.promises.readFile as never);
  vi.mocked(fsp.writeFile).mockImplementation(memfs.fs.promises.writeFile as never);
  vi.mocked(fsp.rm).mockImplementation(memfs.fs.promises.rm as never);
  vi.mocked(fsp.access).mockImplementation(memfs.fs.promises.access as never);
  vi.mocked(runCommand).mockReset();
  failResolutions();
  vol.mkdirSync(SANDBOX, { recursive: true });
});

describe('preapproveLocallyPublishedPackages', () => {
  it('keeps the age gate in force rather than disabling it', async () => {
    vol.writeFileSync(
      WORKSPACE,
      yml.stringify({ nodeLinker: 'hoisted', minimumReleaseAge: 10080 })
    );

    await preapproveLocallyPublishedPackages(SANDBOX);

    // The whole point: the after-storybook install is the only step that runs
    // package code, so the gate must survive this call.
    expect(readWorkspace()).toMatchObject({ nodeLinker: 'hoisted', minimumReleaseAge: 10080 });
  });

  it('merges with the template exemptions instead of replacing them', async () => {
    vol.writeFileSync(
      WORKSPACE,
      yml.stringify({
        minimumReleaseAge: 10080,
        minimumReleaseAgeExclude: ['next', '@next/*', 'eslint-config-next'],
      })
    );

    await preapproveLocallyPublishedPackages(SANDBOX);

    const excluded: string[] = readWorkspace().minimumReleaseAgeExclude;
    // A prerelease template must not lose its own entries.
    expect(excluded).toEqual(expect.arrayContaining(['next', '@next/*', 'eslint-config-next']));
    expect(excluded).toEqual(expect.arrayContaining([...LOCALLY_PUBLISHED_PACKAGE_PATTERNS]));
    expect(excluded.length).toBe(new Set(excluded).size);
  });

  it('adds the exemptions when the template has none', async () => {
    vol.writeFileSync(WORKSPACE, yml.stringify({ minimumReleaseAge: 10080 }));

    await preapproveLocallyPublishedPackages(SANDBOX);

    expect(readWorkspace().minimumReleaseAgeExclude).toEqual([
      ...LOCALLY_PUBLISHED_PACKAGE_PATTERNS,
    ]);
  });

  it('still writes a usable config when no pnpm-workspace.yaml exists', async () => {
    await preapproveLocallyPublishedPackages(SANDBOX);

    expect(readWorkspace().minimumReleaseAgeExclude).toEqual([
      ...LOCALLY_PUBLISHED_PACKAGE_PATTERNS,
    ]);
  });

  it('covers the packages the local registry serves', async () => {
    // run-registry publishes these; they are seconds old at install time.
    expect(LOCALLY_PUBLISHED_PACKAGE_PATTERNS).toEqual(
      expect.arrayContaining([
        'storybook',
        '@storybook/*',
        'create-storybook',
        'vite-plugin-storybook-nextjs',
      ])
    );
  });
});

describe('finishAfterStorybook', () => {
  const INITIATED = {
    name: 'before-storybook',
    dependencies: { react: '^19.3.1', 'react-dom': '^19.3.1' },
    devDependencies: {
      '@types/node': '^24.19.2',
      oxlint: '^1.89.0',
      vite: '^8.3.5',
      storybook: '^11.0.0-beta.1',
      '@storybook/react-vite': '^11.0.0-beta.1',
      '@chromatic-com/storybook': 'latest',
      vitest: 'latest',
      '@vitest/browser-playwright': 'latest',
    },
    packageManager: monorepoPackageManager,
    resolutions: {
      storybook: '11.0.0-beta.1',
      '@storybook/addon-a11y': '11.0.0-beta.1',
      '@storybook/react-vite': '11.0.0-beta.1',
    },
  };

  beforeEach(() => {
    vol.writeFileSync(`${SANDBOX}/package.json`, JSON.stringify(INITIATED));
  });

  it('gives after-storybook a 1-day gate and keeps what init wrote', async () => {
    vol.writeFileSync(
      WORKSPACE,
      yml.stringify({
        packages: ['.'],
        minimumReleaseAge: 10080,
        minimumReleaseAgeExclude: ['storybook', '@storybook/*'],
        allowBuilds: { esbuild: true },
      })
    );

    await finishAfterStorybook(SANDBOX);

    expect(readWorkspace()).toEqual({
      packages: ['.'],
      minimumReleaseAge: 1440,
      minimumReleaseAgeExclude: ['storybook', '@storybook/*'],
      allowBuilds: { esbuild: true },
    });
  });

  it('sorts the dependencies init appended, so npm installs them', async () => {
    await finishAfterStorybook(SANDBOX);

    expect(Object.keys(readManifest().devDependencies)).toEqual([
      '@chromatic-com/storybook',
      '@storybook/react-vite',
      '@types/node',
      '@vitest/browser-playwright',
      'oxlint',
      'storybook',
      'vite',
      'vitest',
    ]);
    expect(Object.keys(readManifest().resolutions)).toEqual(Object.keys(INITIATED.resolutions));
  });

  it('pins the dependencies that resolutions names to their versions', async () => {
    await finishAfterStorybook(SANDBOX);

    expect(readManifest()).toEqual({
      ...INITIATED,
      devDependencies: {
        ...INITIATED.devDependencies,
        storybook: '11.0.0-beta.1',
        '@storybook/react-vite': '11.0.0-beta.1',
      },
    });
  });
});

describe('PUBLISHED_SANDBOX_USER_AGENT', () => {
  it('scaffolds published sandboxes as the pnpm they pin, without the hash', () => {
    const version = monorepoPackageManager.replace(/^pnpm@/, '').split('+')[0];

    expect(PUBLISHED_SANDBOX_USER_AGENT.split(' ')[0]).toBe(`pnpm/${version}`);
  });
});

describe('parsePnpmErrorRecords', () => {
  it('reads the error records and drops the registry document they carry', () => {
    const records = parsePnpmErrorRecords(
      [PROGRESS, 'not json', gated('vite', '8.3.8'), ''].join('\n')
    );

    expect(records).toEqual([
      expect.objectContaining({
        code: 'ERR_PNPM_NO_MATURE_MATCHING_VERSION',
        package: { name: 'vite', bareSpecifier: '8.3.8', version: '8.3.8' },
        pkgsStack: [],
      }),
    ]);
    expect(records[0]).not.toHaveProperty('packageMeta');
  });
});

describe('refreshBeforeStorybookLockfile', () => {
  const MANIFEST = {
    name: 'angular-latest',
    dependencies: { '@angular/build': '^22.1.3', rxjs: '~7.8.0', esbuild: '~0.25.3' },
    devDependencies: { typescript: '~6.0.2' },
  };

  beforeEach(() => {
    vol.writeFileSync(`${SANDBOX}/package.json`, JSON.stringify(MANIFEST));
  });

  it('pins the monorepo pnpm, including its hash', async () => {
    await refreshBeforeStorybookLockfile({ cwd: SANDBOX });

    expect(PUBLISHED_SANDBOX_PACKAGE_MANAGER).toBe(monorepoPackageManager);
    expect(readManifest().packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+\+sha512\./);
    expect(readManifest().packageManager).toBe(monorepoPackageManager);
  });

  it('sorts the dependencies the scaffolder wrote, and keeps them sorted when widening', async () => {
    vol.writeFileSync(
      `${SANDBOX}/package.json`,
      JSON.stringify({
        dependencies: { react: '19.1.0', 'react-dom': '19.1.0', next: '15.5.29' },
        devDependencies: { typescript: '^5', '@types/node': '^20', '@eslint/eslintrc': '^3' },
      })
    );
    failResolutions(failed(gated('next', '15.5.29')));

    await refreshBeforeStorybookLockfile({ cwd: SANDBOX });

    expect(Object.keys(readManifest().dependencies)).toEqual(['next', 'react', 'react-dom']);
    expect(Object.keys(readManifest().devDependencies)).toEqual([
      '@eslint/eslintrc',
      '@types/node',
      'typescript',
    ]);
    expect(readManifest().dependencies.next).toBe('^15.0.0');
  });

  it('makes the sandbox its own hoisted workspace under the 7-day gate', async () => {
    await refreshBeforeStorybookLockfile({ cwd: SANDBOX });

    expect(readWorkspace()).toEqual({
      packages: ['.'],
      nodeLinker: 'hoisted',
      minimumReleaseAge: 10080,
    });
  });

  it('keeps the settings a scaffolder wrote into pnpm-workspace.yaml', async () => {
    vol.writeFileSync(
      WORKSPACE,
      yml.stringify({
        packages: ['apps/*'],
        ignoredBuiltDependencies: ['sharp', 'unrs-resolver'],
        allowBuilds: { esbuild: true },
      })
    );

    await refreshBeforeStorybookLockfile({ cwd: SANDBOX });

    expect(readWorkspace()).toEqual({
      packages: ['.'],
      ignoredBuiltDependencies: ['sharp', 'unrs-resolver'],
      allowBuilds: { esbuild: true },
      nodeLinker: 'hoisted',
      minimumReleaseAge: 10080,
    });
  });

  it('exempts packages from the gate only for templates that name them', async () => {
    vol.writeFileSync(WORKSPACE, yml.stringify({ minimumReleaseAgeExclude: ['@next/swc-*'] }));

    await refreshBeforeStorybookLockfile({
      cwd: SANDBOX,
      minAgeGateExemptions: ['next', '@next/*', '@next/swc-*'],
    });

    expect(readWorkspace().minimumReleaseAgeExclude).toEqual(['@next/swc-*', 'next', '@next/*']);
  });

  it('removes Yarn files and foreign lockfiles, but not the scaffolder .npmrc', async () => {
    for (const file of ['yarn.lock', 'package-lock.json', 'pnpm-lock.yaml', '.yarnrc.yml']) {
      vol.writeFileSync(`${SANDBOX}/${file}`, '');
    }
    vol.mkdirSync(`${SANDBOX}/.yarn/releases`, { recursive: true });
    vol.writeFileSync(`${SANDBOX}/.npmrc`, 'engine-strict=true\n');

    await refreshBeforeStorybookLockfile({ cwd: SANDBOX });

    expect(vol.readFileSync(`${SANDBOX}/.npmrc`, 'utf-8')).toBe('engine-strict=true\n');
    for (const file of [
      'yarn.lock',
      'package-lock.json',
      'pnpm-lock.yaml',
      '.yarnrc.yml',
      '.yarn',
    ]) {
      expect(vol.existsSync(`${SANDBOX}/${file}`), file).toBe(false);
    }
  });

  it('resolves only the lockfile, against the public registry, in one run when nothing is gated', async () => {
    await refreshBeforeStorybookLockfile({ cwd: SANDBOX });

    expect(commands()).toEqual([RESOLVE]);
    const [[, options]] = vi.mocked(runCommand).mock.calls;
    expect(options).toMatchObject({
      cwd: SANDBOX,
      stdout: 'pipe',
      maxBuffer: expect.any(Number),
      env: { CI: 'true', COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' },
    });
    // The vite registry document alone is 2.4 MB, and `next`'s is 31.5 MB.
    expect(options?.maxBuffer).toBeGreaterThan(100_000_000);
  });

  it('widens only the gated range, inside its major', async () => {
    failResolutions(failed(gated('@angular/build', '22.1.3')));

    await refreshBeforeStorybookLockfile({ cwd: SANDBOX });

    expect(commands()).toEqual([RESOLVE, RESOLVE]);
    // The regression the Yarn loop once had: widening everything moved `typescript: ~6.0.2` to 7.
    expect(readManifest()).toMatchObject({
      dependencies: { '@angular/build': '^22.0.0', rxjs: '~7.8.0', esbuild: '~0.25.3' },
      devDependencies: { typescript: '~6.0.2' },
    });
  });

  it('keeps the minor of a 0.x range and the field of a dev dependency', async () => {
    failResolutions(failed(gated('esbuild', '0.25.3')), failed(gated('typescript', '6.0.2')));

    await refreshBeforeStorybookLockfile({ cwd: SANDBOX });

    expect(readManifest()).toMatchObject({
      dependencies: { esbuild: '^0.25.0' },
      devDependencies: { typescript: '^6.0.0' },
    });
  });

  it('accumulates ranges across rounds, because pnpm reports one package per run', async () => {
    failResolutions(failed(gated('@angular/build', '22.1.3')), failed(gated('rxjs', '7.8.2')));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await refreshBeforeStorybookLockfile({ cwd: SANDBOX });

    expect(commands()).toEqual([RESOLVE, RESOLVE, RESOLVE]);
    expect(readManifest().dependencies).toMatchObject({
      '@angular/build': '^22.0.0',
      rxjs: '^7.0.0',
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('@angular/build@^22.0.0, rxjs@^7.0.0')
    );
  });

  it('names a gated transitive dependency instead of widening anything', async () => {
    // `@expo/config-plugins` moved to `xcode: ^4.0.0` while `xcode@4.0.0` was still
    // quarantined. Only the parent declares the range.
    failResolutions(
      failed(
        gated('xcode', '4.0.0', [
          { id: '@expo/config-plugins@9.0.0', name: '@expo/config-plugins' },
        ])
      )
    );

    await expect(refreshBeforeStorybookLockfile({ cwd: SANDBOX })).rejects.toThrow(
      /xcode.*not a direct dependency.*minAgeGateExemptions/s
    );
    expect(commands()).toEqual([RESOLVE]);
    expect(readManifest().dependencies).toEqual(MANIFEST.dependencies);
  });

  it('treats a gated package the manifest does not declare as transitive', async () => {
    failResolutions(failed(gated('caniuse-lite', '1.0.30001826')));

    await expect(refreshBeforeStorybookLockfile({ cwd: SANDBOX })).rejects.toThrow(
      /caniuse-lite.*not a direct dependency/
    );
  });

  it('gives up rather than leave the major when the widened range is still gated', async () => {
    failResolutions(...Array.from({ length: 5 }, () => failed(gated('@angular/build', '22.1.3'))));

    await expect(refreshBeforeStorybookLockfile({ cwd: SANDBOX })).rejects.toThrow(
      /@angular\/build@\^22\.0\.0 still has no release older than the 7-day age gate/
    );
    expect(commands()).toEqual([RESOLVE, RESOLVE]);
  });

  it('refuses to widen a prerelease pin to a stable release', async () => {
    vol.writeFileSync(
      `${SANDBOX}/package.json`,
      JSON.stringify({ dependencies: { next: '16.3.1-canary.3' } })
    );
    failResolutions(failed(gated('next', '16.3.1-canary.3')));

    // Every stable 16.x sorts above the canary, so widening would land on stable.
    await expect(refreshBeforeStorybookLockfile({ cwd: SANDBOX })).rejects.toThrow(
      /stable release.*minAgeGateExemptions/
    );
  });

  it('refuses a range that names no version to widen from', async () => {
    vol.writeFileSync(
      `${SANDBOX}/package.json`,
      JSON.stringify({ dependencies: { vite: 'npm:rolldown-vite@7.1.0' } })
    );
    failResolutions(failed(gated('vite', '7.1.0')));

    await expect(refreshBeforeStorybookLockfile({ cwd: SANDBOX })).rejects.toThrow(
      /vite@npm:rolldown-vite@7\.1\.0 .*names no version to widen from/
    );
  });

  it('says so when it cannot read the package out of a gate error', async () => {
    // pnpm's default reporter, in case the ndjson reporter ever stops being used.
    const text = Object.assign(new Error('pnpm failed'), {
      stdout:
        ' ERR_PNPM_NO_MATURE_MATCHING_VERSION  Version 8.3.8 (released 10 hours ago) of vite does not meet the minimumReleaseAge constraint',
    });
    failResolutions(text);

    await expect(refreshBeforeStorybookLockfile({ cwd: SANDBOX })).rejects.toThrow(
      /Could not read the quarantined package/
    );
  });

  it('says so when a gate record names no package', async () => {
    failResolutions(
      failed(errorLine({ code: 'ERR_PNPM_NO_MATURE_MATCHING_VERSION', pkgsStack: [] }))
    );

    await expect(refreshBeforeStorybookLockfile({ cwd: SANDBOX })).rejects.toThrow(
      /Could not read the quarantined package/
    );
  });

  it("reports another failure by pnpm's reason, without its multi-megabyte output", async () => {
    failResolutions(
      failed(
        errorLine({
          code: 'ERR_PNPM_FETCH_404',
          err: { message: 'GET https://registry.npmjs.org/no-such-package: Not Found - 404' },
        })
      )
    );

    const error = await refreshError();

    expect(error.message).toContain(`Command failed with exit code 1: ${RESOLVE}`);
    expect(error.message).toContain(
      'ERR_PNPM_FETCH_404: GET https://registry.npmjs.org/no-such-package: Not Found - 404'
    );
    expect(error.message).not.toContain('registry-document');
    expect(error.message.length).toBeLessThan(10_000);
    expect(Object.keys(error)).not.toContain('stdout');
    expect(commands()).toEqual([RESOLVE]);
  });

  it('shows the end of the output when pnpm failed before its reporter ran', async () => {
    failResolutions(
      Object.assign(new Error('pnpm failed'), {
        stdout: `${'.'.repeat(100_000)}\nThis project is configured to use yarn`,
      })
    );

    const error = await refreshError();

    expect(error.message).toContain('This project is configured to use yarn');
    expect(error.message.length).toBeLessThan(10_000);
  });

  it('stops after a bounded number of rounds', async () => {
    const names = Array.from({ length: 40 }, (_, i) => `pkg-${i}`);
    vol.writeFileSync(
      `${SANDBOX}/package.json`,
      JSON.stringify({ dependencies: Object.fromEntries(names.map((name) => [name, '1.2.3'])) })
    );
    failResolutions(...names.map((name) => failed(gated(name, '1.2.3'))));

    await expect(refreshBeforeStorybookLockfile({ cwd: SANDBOX })).rejects.toThrow(
      /Still hitting the 7-day age gate after 25 rounds/
    );
    expect(commands()).toHaveLength(26);
  });
});

describe('ensureNpmSupportsMinReleaseAge', () => {
  it(`accepts npm ${BEFORE_SANDBOX_NPM_MIN_VERSION} and newer`, async () => {
    vi.mocked(runCommand).mockResolvedValue({ stdout: '11.17.0\n' } as never);

    await expect(ensureNpmSupportsMinReleaseAge()).resolves.toBeUndefined();

    vi.mocked(runCommand).mockResolvedValue({ stdout: '12.0.2\n' } as never);
    await expect(ensureNpmSupportsMinReleaseAge()).resolves.toBeUndefined();
  });

  it('fails when npm is older than the min-release-age floor', async () => {
    vi.mocked(runCommand).mockResolvedValue({ stdout: '11.10.0\n' } as never);

    await expect(ensureNpmSupportsMinReleaseAge()).rejects.toThrow(
      new RegExp(`npm >= ${BEFORE_SANDBOX_NPM_MIN_VERSION}.*found 11\\.10\\.0`)
    );
  });
});

describe('writeScaffoldNpmrc', () => {
  it('writes min-release-age and exclude patterns for npm scaffolds', async () => {
    await writeScaffoldNpmrc(SANDBOX, ['@react-native-community/*', 'multitars']);

    expect(vol.readFileSync(`${SANDBOX}/.npmrc`, 'utf-8')).toBe(
      'min-release-age=7\nmin-release-age-exclude[]=@react-native-community/*\nmin-release-age-exclude[]=multitars\n'
    );
  });

  it('does nothing when the allowlist is empty', async () => {
    await writeScaffoldNpmrc(SANDBOX, []);

    expect(vol.existsSync(`${SANDBOX}/.npmrc`)).toBe(false);
  });
});
