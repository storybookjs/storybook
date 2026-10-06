import { describe, expect, it } from 'vitest';

import type { PresetConfig, StorybookConfigRaw } from 'storybook/internal/types';

import { getPresets } from '../../common/presets.ts';
import * as overridePreset from './common-override-preset.ts';
import * as commonPreset from './common-preset.ts';

const docgenProvider = {
  isDocgenProviderEnabled: true,
  experimental_docgenProvider: async (existing: unknown[] = []) => [
    ...existing,
    { moduleSpecifier: '/provider/docgen-worker.js' },
  ],
};

async function resolveDocgenServer(
  presets: object[],
  build?: StorybookConfigRaw['build']
): Promise<boolean | undefined> {
  const presetConfigs = [commonPreset, ...presets, overridePreset].map(
    (contents, index) => ({ type: 'virtual', name: `preset-${index}`, ...contents }) as PresetConfig
  );
  const loaded = await getPresets(presetConfigs, {
    configDir: '/project/.storybook',
    isCritical: true,
    build,
  } as never);
  const features = await loaded.apply('features', {});
  return features.docgenServer;
}

describe('features.docgenServer', () => {
  it('is enabled when a preset declares a docgen provider', async () => {
    expect(await resolveDocgenServer([docgenProvider])).toBe(true);
  });

  it('is disabled when the provider preset reports it cannot run', async () => {
    expect(
      await resolveDocgenServer([{ ...docgenProvider, isDocgenProviderEnabled: () => false }])
    ).toBe(false);
  });

  it('is disabled when no preset declares a docgen provider', async () => {
    expect(await resolveDocgenServer([])).toBe(false);
  });

  it('lets the main config opt out of an available provider', async () => {
    expect(await resolveDocgenServer([docgenProvider, { features: { docgenServer: false } }])).toBe(
      false
    );
  });

  it('lets the main config opt in without a provider', async () => {
    expect(await resolveDocgenServer([{ features: { docgenServer: true } }])).toBe(true);
  });

  it('is disabled for test builds that disable docgen', async () => {
    expect(await resolveDocgenServer([docgenProvider], { test: { disableDocgen: true } })).toBe(
      false
    );
  });
});
