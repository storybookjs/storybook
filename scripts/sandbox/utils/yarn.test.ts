import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as memfs from 'memfs';
import { vol } from 'memfs';
import yml from 'yaml';

import { LOCALLY_PUBLISHED_PACKAGE_PATTERNS, preapproveLocallyPublishedPackages } from './yarn.ts';

vi.mock('node:fs/promises', { spy: true });

const SANDBOX = resolve('sandbox');
const CONFIG = `${SANDBOX}/.yarnrc.yml`;

const readConfig = () => yml.parse(vol.readFileSync(CONFIG, 'utf-8') as string);

beforeEach(async () => {
  vol.reset();
  const fsp = await import('node:fs/promises');
  vi.mocked(fsp.readFile).mockImplementation(memfs.fs.promises.readFile as never);
  vi.mocked(fsp.writeFile).mockImplementation(memfs.fs.promises.writeFile as never);
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
