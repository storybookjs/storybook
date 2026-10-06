import { describe, expect, it } from 'vitest';

import { features } from './preset.ts';

describe('features', () => {
  const applyFeatures = features as (existing: unknown) => Promise<Record<string, unknown>>;

  it('turns component manifests on by default', async () => {
    expect(await applyFeatures({})).toMatchObject({ componentsManifest: true });
  });

  it('keeps other feature defaults from earlier presets', async () => {
    expect(await applyFeatures({ changeDetection: true })).toMatchObject({
      changeDetection: true,
      componentsManifest: true,
    });
  });
});
