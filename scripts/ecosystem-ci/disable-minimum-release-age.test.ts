import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as memfs from 'memfs';
import { vol } from 'memfs';
import { parse } from 'yaml';

import { disableMinimumReleaseAge } from './disable-minimum-release-age.ts';

vi.mock('node:fs/promises', { spy: true });

const SANDBOX = resolve('sandbox');
const CONFIG = `${SANDBOX}/pnpm-workspace.yaml`;

beforeEach(async () => {
  vol.reset();
  const fsp = await import('node:fs/promises');
  vi.mocked(fsp.readFile).mockImplementation(memfs.fs.promises.readFile as never);
  vi.mocked(fsp.writeFile).mockImplementation(memfs.fs.promises.writeFile as never);
  vol.mkdirSync(SANDBOX, { recursive: true });
});

const readConfig = () => parse(vol.readFileSync(CONFIG, 'utf-8') as string);

describe('disableMinimumReleaseAge', () => {
  it('sets the gate to 0 and leaves the rest of the config', async () => {
    vol.writeFileSync(
      CONFIG,
      'packages:\n  - .\nminimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  - storybook\n'
    );

    await disableMinimumReleaseAge(SANDBOX);

    expect(readConfig()).toEqual({
      packages: ['.'],
      minimumReleaseAge: 0,
      minimumReleaseAgeExclude: ['storybook'],
    });
  });

  it('creates a config that sets the gate to 0 when none exists', async () => {
    await disableMinimumReleaseAge(SANDBOX);

    expect(readConfig()).toEqual({ minimumReleaseAge: 0 });
  });
});
