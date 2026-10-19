import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as memfs from 'memfs';
import { vol } from 'memfs';

import { disableNpmMinimalAgeGate } from './disable-npm-minimal-age-gate.js';

vi.mock('node:fs/promises', { spy: true });

const SANDBOX = resolve('sandbox');
const CONFIG = `${SANDBOX}/.yarnrc.yml`;

beforeEach(async () => {
  vol.reset();
  const fsp = await import('node:fs/promises');
  vi.mocked(fsp.readFile).mockImplementation(memfs.fs.promises.readFile as never);
  vi.mocked(fsp.writeFile).mockImplementation(memfs.fs.promises.writeFile as never);
  vol.mkdirSync(SANDBOX, { recursive: true });
});

const readConfig = () => vol.readFileSync(CONFIG, 'utf-8') as string;

describe('disableNpmMinimalAgeGate', () => {
  it('sets an existing gate to 0 and leaves the rest of the config', async () => {
    vol.writeFileSync(
      CONFIG,
      'nodeLinker: node-modules\nnpmMinimalAgeGate: 10080\nnpmPreapprovedPackages:\n  - storybook\n'
    );

    await disableNpmMinimalAgeGate(SANDBOX);

    expect(readConfig()).toBe(
      'nodeLinker: node-modules\nnpmMinimalAgeGate: 0\nnpmPreapprovedPackages:\n  - storybook\n'
    );
  });

  it('rewrites every occurrence, including one that is already 0', async () => {
    vol.writeFileSync(
      CONFIG,
      'npmMinimalAgeGate: 0\nnpmScopes:\n  example:\n    npmMinimalAgeGate: 7d\n'
    );

    await disableNpmMinimalAgeGate(SANDBOX);

    expect(readConfig()).toBe(
      'npmMinimalAgeGate: 0\nnpmScopes:\n  example:\n    npmMinimalAgeGate: 0\n'
    );
  });

  it('appends a zero gate when the config does not set one', async () => {
    vol.writeFileSync(CONFIG, 'nodeLinker: node-modules');

    await disableNpmMinimalAgeGate(SANDBOX);

    expect(readConfig()).toBe('nodeLinker: node-modules\nnpmMinimalAgeGate: 0\n');
  });

  it('creates a config that sets the gate to 0 when none exists', async () => {
    await disableNpmMinimalAgeGate(SANDBOX);

    expect(readConfig()).toBe('npmMinimalAgeGate: 0\n');
  });
});
