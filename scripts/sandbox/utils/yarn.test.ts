import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as memfs from 'memfs';
import { vol } from 'memfs';
import yml from 'yaml';

import { ROOT_DIRECTORY } from '../../utils/constants.ts';
import { runCommand } from '../generate.ts';
import {
  BEFORE_SANDBOX_NPM_MIN_VERSION,
  LOCALLY_PUBLISHED_PACKAGE_PATTERNS,
  ensureNpmSupportsMinReleaseAge,
  preapproveLocallyPublishedPackages,
  refreshBeforeStorybookLockfile,
  writeScaffoldNpmrc,
} from './yarn.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('../generate.ts', () => ({ runCommand: vi.fn() }));

const SANDBOX = resolve('sandbox');
const CONFIG = `${SANDBOX}/.yarnrc.yml`;

const readConfig = () => yml.parse(vol.readFileSync(CONFIG, 'utf-8') as string);

beforeEach(async () => {
  vol.reset();
  const fsp = await import('node:fs/promises');
  vi.mocked(fsp.readFile).mockImplementation(memfs.fs.promises.readFile as never);
  vi.mocked(fsp.writeFile).mockImplementation(memfs.fs.promises.writeFile as never);
  vi.mocked(fsp.rm).mockImplementation(memfs.fs.promises.rm as never);
  vol.mkdirSync(SANDBOX, { recursive: true });
});

describe('preapproveLocallyPublishedPackages', () => {
  it('keeps the age gate in force rather than disabling it', async () => {
    vol.writeFileSync(
      CONFIG,
      yml.stringify({ nodeLinker: 'node-modules', npmMinimalAgeGate: 10080 })
    );

    await preapproveLocallyPublishedPackages(SANDBOX);

    // The whole point: the after-storybook install is the only step that runs
    // package code, so the gate must survive this call.
    expect(readConfig().npmMinimalAgeGate).toBe(10080);
    expect(readConfig().nodeLinker).toBe('node-modules');
  });

  it('merges with a template allowlist instead of replacing it', async () => {
    vol.writeFileSync(
      CONFIG,
      yml.stringify({
        npmMinimalAgeGate: 10080,
        npmPreapprovedPackages: ['next', '@next/*', 'eslint-config-next'],
      })
    );

    await preapproveLocallyPublishedPackages(SANDBOX);

    const approved: string[] = readConfig().npmPreapprovedPackages;
    // A prerelease template must not lose its own entries.
    expect(approved).toEqual(expect.arrayContaining(['next', '@next/*', 'eslint-config-next']));
    expect(approved).toEqual(expect.arrayContaining([...LOCALLY_PUBLISHED_PACKAGE_PATTERNS]));
    expect(approved.length).toBe(new Set(approved).size);
  });

  it('adds the allowlist when the template has none', async () => {
    vol.writeFileSync(CONFIG, yml.stringify({ npmMinimalAgeGate: 10080 }));

    await preapproveLocallyPublishedPackages(SANDBOX);

    expect(readConfig().npmPreapprovedPackages).toEqual([...LOCALLY_PUBLISHED_PACKAGE_PATTERNS]);
  });

  it('still writes a usable config when no .yarnrc.yml exists', async () => {
    await preapproveLocallyPublishedPackages(SANDBOX);

    expect(readConfig().npmPreapprovedPackages).toEqual([...LOCALLY_PUBLISHED_PACKAGE_PATTERNS]);
  });

  it('covers the packages the local registry serves', async () => {
    // run-registry publishes these; they are seconds old at install time.
    expect(LOCALLY_PUBLISHED_PACKAGE_PATTERNS).toEqual(
      expect.arrayContaining(['storybook', '@storybook/*', 'create-storybook'])
    );
  });
});

describe('refreshBeforeStorybookLockfile', () => {
  const MANIFEST = {
    name: 'angular-latest',
    dependencies: { '@angular/build': '^22.1.3', rxjs: '~7.8.0' },
    devDependencies: { typescript: '~6.0.2' },
  };

  /** Yarn's age-gate rejection, verbatim, as it reaches us on the failed command's stdout. */
  const quarantined = (descriptor: string) =>
    Object.assign(new Error('yarn failed'), {
      stdout: `➤ YN0016: │ ${descriptor}: All versions satisfying "x" are quarantined`,
    });

  const isResolveStep = (script: string) => /^yarn (install|up)\b/.test(script);

  /** The resolve steps, ignoring the `yarn config set` preamble. */
  const yarnCommands = () =>
    vi
      .mocked(runCommand)
      .mock.calls.map(([script]) => script)
      .filter(isResolveStep);

  /** Fail the first N resolve steps, letting the `yarn config set` preamble through. */
  const failResolveSteps = (...errors: Error[]) => {
    const queue = [...errors];
    vi.mocked(runCommand).mockImplementation((async (script: string) => {
      if (isResolveStep(script) && queue.length) {
        throw queue.shift();
      }
      return { stdout: '' };
    }) as never);
  };

  beforeEach(() => {
    vol.writeFileSync(`${SANDBOX}/package.json`, JSON.stringify(MANIFEST));
    // pinYarnPackageManager reads the monorepo root manifest.
    vol.mkdirSync(ROOT_DIRECTORY, { recursive: true });
    vol.writeFileSync(
      `${ROOT_DIRECTORY}/package.json`,
      JSON.stringify({ packageManager: 'yarn@4.18.0' })
    );
    failResolveSteps();
  });

  it('installs the template ranges as-is when nothing is quarantined', async () => {
    await refreshBeforeStorybookLockfile({ cwd: SANDBOX });

    expect(yarnCommands()).toEqual(['yarn install --mode=update-lockfile']);
  });

  it('upgrades only the quarantined package, leaving every other range alone', async () => {
    failResolveSteps(quarantined('@angular/build@npm:^22.1.3'));

    await refreshBeforeStorybookLockfile({ cwd: SANDBOX });

    // The regression: `yarn up '*'` swept up `typescript: ~6.0.2` into `^7.0.2`.
    expect(yarnCommands()).not.toContain(expect.stringContaining("'*'"));
    expect(yarnCommands()).toContain(`yarn up '@angular/build@^22.0.0' --mode=update-lockfile`);
  });

  it('keeps a quarantined package inside the major the template pinned', async () => {
    vol.writeFileSync(
      `${SANDBOX}/package.json`,
      JSON.stringify({ dependencies: { '@angular/build': '^21.2.19' } })
    );
    failResolveSteps(quarantined('@angular/build@npm:^21.2.19'));

    await refreshBeforeStorybookLockfile({ cwd: SANDBOX });

    // A bare `yarn up` would move this template to Angular 22 and stop it testing 21.
    expect(yarnCommands()).toContain(`yarn up '@angular/build@^21.0.0' --mode=update-lockfile`);
  });

  it('accumulates packages across rounds, because Yarn only reports the first', async () => {
    failResolveSteps(quarantined('@angular/build@npm:^22.1.3'), quarantined('rxjs@npm:~7.8.0'));

    await refreshBeforeStorybookLockfile({ cwd: SANDBOX });

    // Yarn re-resolves everything, so the second package joins the first `yarn up`.
    expect(yarnCommands()).toContain(
      `yarn up '@angular/build@^22.0.0' 'rxjs@^7.0.0' --mode=update-lockfile`
    );
  });

  it('refuses to narrow a prerelease pin down to a stable release', async () => {
    vol.writeFileSync(
      `${SANDBOX}/package.json`,
      JSON.stringify({ dependencies: { next: '16.3.1-canary.3' } })
    );
    failResolveSteps(quarantined('next@npm:16.3.1-canary.3'));

    // Every stable 16.x sorts above the canary, so narrowing would land on stable.
    await expect(refreshBeforeStorybookLockfile({ cwd: SANDBOX })).rejects.toThrow(
      /minAgeGateExemptions/
    );
  });

  it('keeps Yarn output plain so the descriptor stays parseable', async () => {
    await refreshBeforeStorybookLockfile({ cwd: SANDBOX });

    // Yarn colourises and hyperlinks when CI is set, which splits `YN0016:` and
    // `name@npm:range` across escapes and leaves nothing for the parser to match.
    const [, options] = vi.mocked(runCommand).mock.calls[0];
    expect(options?.env).toMatchObject({
      YARN_ENABLE_COLORS: 'false',
      YARN_ENABLE_HYPERLINKS: 'false',
    });
  });

  it('says so when it cannot read a package out of a quarantine report', async () => {
    // Yarn's colourised form, captured from a real run. If output ever looks like this
    // again the parser must fail loudly rather than blame resolution.
    const unparseable = Object.assign(new Error('yarn failed'), {
      stdout:
        '\u001B[91m\u27A4\u001B[39m \u001B]8;;https://yarnpkg.com/advanced/error-codes#yn0016---remote_not_found\u0007YN0016\u001B]8;;\u0007: \u2502 \u001B[91m@tailwindcss/\u001B[39m\u001B[91mturbopack\u001B[39m\u001B[36m@\u001B[39m\u001B[36mnpm:^4.3.3\u001B[39m: All versions satisfying "^4.3.3" are quarantined',
    });
    failResolveSteps(unparseable);

    await expect(refreshBeforeStorybookLockfile({ cwd: SANDBOX })).rejects.toThrow(
      /Could not read the quarantined package/
    );
  });

  it('surfaces a failure that is not the age gate instead of upgrading blindly', async () => {
    const offline = Object.assign(new Error('yarn failed'), { stdout: 'ENOTFOUND registry' });
    failResolveSteps(offline);

    await expect(refreshBeforeStorybookLockfile({ cwd: SANDBOX })).rejects.toThrow(offline);
    expect(yarnCommands()).not.toContain(expect.stringContaining('yarn up'));
  });

  it('gives up rather than leave the major when a whole major is quarantined', async () => {
    // Yarn keeps naming the same package: nothing in `^22` is old enough either.
    failResolveSteps(
      ...Array.from({ length: 50 }, () => quarantined('@angular/build@npm:^22.1.3'))
    );

    await expect(refreshBeforeStorybookLockfile({ cwd: SANDBOX })).rejects.toThrow();
  });
});

describe('ensureNpmSupportsMinReleaseAge', () => {
  beforeEach(() => {
    vi.mocked(runCommand).mockReset();
  });

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
