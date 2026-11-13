import { mkdirSync, writeFileSync } from 'node:fs';

import { fs as memfs, vol } from 'memfs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CHECKOUT_GUIDE, guideFor } from './migration-guide.ts';

vi.mock('node:fs', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(mkdirSync).mockImplementation(memfs.mkdirSync as typeof mkdirSync);
  vi.mocked(writeFileSync).mockImplementation(memfs.writeFileSync as typeof writeFileSync);
});

const PLACES = { checkout: '/monorepo/MIGRATION.md', saveTo: '/scratch/guides/MIGRATION.md' };

const answering = (status: number, text = '') =>
  vi.fn(async (_url: string) => new Response(text, { status }));

describe('guideFor', () => {
  it('saves the guide of the tag of the tested version and names that tag', async () => {
    const load = answering(200, '## From version 10.x to 11.0.0\n');

    await expect(guideFor('11.0.0-beta.2', { ...PLACES, load })).resolves.toEqual({
      file: '/scratch/guides/MIGRATION.md',
      ref: 'v11.0.0-beta.2',
    });
    expect(load).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/storybookjs/storybook/v11.0.0-beta.2/MIGRATION.md'
    );
    expect(vol.toJSON()).toEqual({
      '/scratch/guides/MIGRATION.md': '## From version 10.x to 11.0.0\n',
    });
  });

  it('falls back to the guide of the checkout for a version without a tag', async () => {
    await expect(
      guideFor('0.0.0-pr-37272-sha-9f92f643', { ...PLACES, load: answering(404) })
    ).resolves.toEqual({ file: '/monorepo/MIGRATION.md', ref: CHECKOUT_GUIDE });
    expect(vol.toJSON()).toEqual({});
  });

  it('fails when the guide cannot be loaded for another reason', async () => {
    await expect(guideFor('11.0.0-beta.2', { ...PLACES, load: answering(503) })).rejects.toThrow(
      'Could not load the migration guide of v11.0.0-beta.2: HTTP 503.'
    );
  });
});
