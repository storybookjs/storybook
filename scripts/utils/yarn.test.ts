import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as memfs from 'memfs';
import { vol } from 'memfs';
import yml from 'yaml';

import { exec } from './exec.ts';
import { installYarn2 } from './yarn.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('./exec.ts', () => ({ exec: vi.fn() }));

const SANDBOX = resolve('sandbox');

beforeEach(async () => {
  vol.reset();
  const fsp = await import('node:fs/promises');
  vi.mocked(fsp.readFile).mockImplementation(memfs.fs.promises.readFile as never);
  vi.mocked(fsp.writeFile).mockImplementation(memfs.fs.promises.writeFile as never);
  vi.mocked(fsp.mkdir).mockImplementation(memfs.fs.promises.mkdir as never);
  vi.mocked(fsp.access).mockImplementation(memfs.fs.promises.access as never);
  vol.mkdirSync(SANDBOX, { recursive: true });
});

/** A sandbox as downloaded from the published repository. */
const publishedSandbox = (config: Record<string, unknown> = {}) => {
  vol.writeFileSync(
    `${SANDBOX}/yarn.lock`,
    '# published lockfile\n"chalk@npm:^4":\n  version: 4.1.2\n'
  );
  vol.writeFileSync(
    `${SANDBOX}/.yarnrc.yml`,
    yml.stringify({ nodeLinker: 'node-modules', npmMinimalAgeGate: 10080, ...config })
  );
};

const readConfig = () => yml.parse(vol.readFileSync(`${SANDBOX}/.yarnrc.yml`, 'utf-8') as string);
const yarnCommands = () =>
  vi
    .mocked(exec)
    .mock.calls.map(([command]) => String(command))
    .join(' && ');

describe('installYarn2', () => {
  it('keeps the published lockfile instead of resolving from scratch', async () => {
    publishedSandbox();

    await installYarn2({ cwd: SANDBOX, dryRun: false, debug: false });

    // Emptying this made every CI run re-resolve the whole tree against live npm.
    expect(vol.readFileSync(`${SANDBOX}/yarn.lock`, 'utf-8')).toContain('version: 4.1.2');
  });

  it('leaves the age gate in force', async () => {
    publishedSandbox();

    await installYarn2({ cwd: SANDBOX, dryRun: false, debug: false });

    expect(readConfig().npmMinimalAgeGate).toBe(10080);
    expect(yarnCommands()).not.toContain('npmMinimalAgeGate 0');
  });

  it('preapproves the locally published Storybook packages instead', async () => {
    publishedSandbox();

    await installYarn2({ cwd: SANDBOX, dryRun: false, debug: false });

    // They are published to Verdaccio seconds before this install, so they can never
    // satisfy the gate on their own.
    expect(readConfig().npmPreapprovedPackages).toEqual(
      expect.arrayContaining(['storybook', '@storybook/*', 'create-storybook', 'sb'])
    );
  });

  it('keeps a template allowlist rather than replacing it', async () => {
    publishedSandbox({ npmPreapprovedPackages: ['next', '@next/*'] });

    await installYarn2({ cwd: SANDBOX, dryRun: false, debug: false });

    const approved: string[] = readConfig().npmPreapprovedPackages;
    expect(approved).toEqual(expect.arrayContaining(['next', '@next/*', 'storybook']));
  });

  it('does not write a yarnPath next to the pinned packageManager', async () => {
    publishedSandbox();

    await installYarn2({ cwd: SANDBOX, dryRun: false, debug: false });

    // corepack aborts when `yarnPath` and `packageManager` disagree.
    expect(yarnCommands()).not.toContain('yarn set version');
  });
});
