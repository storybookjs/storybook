import { describe, expect, it, vi } from 'vitest';

import type { Options } from '../../types/index.ts';

import { resolveSkillInputs } from './inputs.ts';

function createMockOptions({
  framework = '@storybook/react-vite',
}: {
  framework?: string | { name: string };
} = {}): Options {
  return {
    presets: {
      apply: vi.fn(async (key: string, defaultValue?: unknown) => {
        if (key === 'framework') {
          return framework;
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

  it.each([
    ['/repo/node_modules/@storybook/vue3-vite', '@storybook/vue3-vite', '@storybook/vue3'],
    [
      'C:\\repo\\node_modules\\@storybook\\angular-vite',
      '@storybook/angular-vite',
      '@storybook/angular',
    ],
    [
      '/repo/node_modules/.pnpm/@storybook+react-vite@11.0.0',
      '@storybook/react-vite',
      '@storybook/react',
    ],
  ])('normalizes absolute framework preset %s', async (name, framework, renderer) => {
    const inputs = await resolveSkillInputs(createMockOptions({ framework: { name } }));
    expect(inputs).toMatchObject({ framework, renderer });
  });

  it('leaves renderer undefined for an unmapped framework', async () => {
    const options = createMockOptions({ framework: '@storybook/some-unmapped-framework' });

    const inputs = await resolveSkillInputs(options);

    expect(inputs.framework).toBe('@storybook/some-unmapped-framework');
    expect(inputs.renderer).toBeUndefined();
  });

  it('spreads the resolved tool availability onto the result', async () => {
    const inputs = await resolveSkillInputs(createMockOptions());

    expect(inputs.moduleGraphSupported).toBe(false);
  });
});
