import { describe, expect, it, vi } from 'vitest';

import type { Options } from '../../types/index.ts';

import { resolveSkillInputs } from './inputs.ts';

function createMockOptions({
  framework = '@storybook/react-vite',
  features,
}: {
  framework?: string | { name: string };
  features?: Record<string, unknown>;
} = {}): Options {
  return {
    presets: {
      apply: vi.fn(async (key: string, defaultValue?: unknown) => {
        if (key === 'framework') {
          return framework;
        }
        if (key === 'features') {
          return features ?? {};
        }
        return defaultValue;
      }),
    },
  } as unknown as Options;
}

describe('resolveSkillInputs', () => {
  it('resolves the framework and its mapped renderer from a string preset', async () => {
    const options = createMockOptions({ framework: '@storybook/vue3-vite' });

    const inputs = await resolveSkillInputs(options);

    expect(inputs.framework).toBe('@storybook/vue3-vite');
    expect(inputs.renderer).toBe('@storybook/vue3');
  });

  it('resolves the framework from an object preset', async () => {
    const options = createMockOptions({ framework: { name: '@storybook/nextjs' } });

    const inputs = await resolveSkillInputs(options);

    expect(inputs.framework).toBe('@storybook/nextjs');
    expect(inputs.renderer).toBe('@storybook/react');
  });

  it('leaves renderer undefined for an unmapped framework', async () => {
    const options = createMockOptions({ framework: '@storybook/some-unmapped-framework' });

    const inputs = await resolveSkillInputs(options);

    expect(inputs.framework).toBe('@storybook/some-unmapped-framework');
    expect(inputs.renderer).toBeUndefined();
  });

  it('spreads the resolved tool availability onto the result', async () => {
    const options = createMockOptions({ features: { changeDetection: true } });

    const inputs = await resolveSkillInputs(options, { moduleGraphSupported: true });

    expect(inputs.moduleGraphSupported).toBe(true);
    expect(inputs.changeDetectionEnabled).toBe(true);
  });

  it('uses pre-resolved features passed via opts and skips re-applying the preset', async () => {
    const options = createMockOptions({ features: { changeDetection: false } });

    const inputs = await resolveSkillInputs(options, {
      features: { changeDetection: true },
      moduleGraphSupported: true,
    });

    // The mock's `presets.apply('features', ...)` would report changeDetection off; an "on"
    // result here proves the pre-resolved value was used instead of re-applying the preset.
    expect(inputs.changeDetectionEnabled).toBe(true);
    expect(options.presets.apply).not.toHaveBeenCalledWith('features', expect.anything());
  });
});
