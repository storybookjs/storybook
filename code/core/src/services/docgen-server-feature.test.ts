import './hooks.ts';

import type { StorybookConfigRaw } from '@storybook/core/internal/types';
import { describe, expect, it } from 'vitest';

import { registerCommonOverrides } from '../instance/common-overrides.ts';
import { createHookRuntime } from '../instance/hooks.ts';
import { features } from './preset.ts';

/** Resolve `features.docgenServer` from core's defaults, a docgen plugin, `main.ts` and core's overrides. */
async function resolveDocgenServer({
  providerEnabled,
  mainFeatures,
  build,
}: {
  providerEnabled?: boolean;
  mainFeatures?: StorybookConfigRaw['features'];
  build?: StorybookConfigRaw['build'];
}): Promise<boolean | undefined> {
  const hooks = createHookRuntime();
  hooks.hook('core:features:extend', (value) => features(value, hooks));
  if (providerEnabled !== undefined) {
    hooks.hook('core:docgen-enabled:extend', () => providerEnabled);
  }
  if (mainFeatures) {
    hooks.hook('core:features:extend', (value) => ({ ...value, ...mainFeatures }));
  }
  registerCommonOverrides(hooks, { build });
  return (await hooks.callHook('core:features:extend', {})).docgenServer;
}

describe('features.docgenServer', () => {
  it.each([
    {
      name: 'a plugin can run a docgen provider',
      input: { providerEnabled: true },
      expected: true,
    },
    {
      name: 'the provider plugin reports it cannot run',
      input: { providerEnabled: false },
      expected: false,
    },
    { name: 'no plugin declares a docgen provider', input: {}, expected: false },
    {
      name: 'main.ts opts out of an available provider',
      input: { providerEnabled: true, mainFeatures: { docgenServer: false } },
      expected: false,
    },
    {
      name: 'main.ts opts in without a provider',
      input: { mainFeatures: { docgenServer: true } },
      expected: true,
    },
    {
      name: 'a test build disables docgen',
      input: { providerEnabled: true, build: { test: { disableDocgen: true } } },
      expected: false,
    },
  ])('$name', async ({ input, expected }) => {
    expect(await resolveDocgenServer(input)).toBe(expected);
  });
});
