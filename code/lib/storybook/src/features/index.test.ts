import { describe, expect, it } from 'vitest';

import type { StorybookFeatures } from '@storybook/core/internal/types';

import { FEATURE_DEFAULTS, builtInAddons, isManagerEnabled } from './index.ts';

const MANAGERS_ON_BY_DEFAULT = [
  'storybook/measure',
  'storybook/backgrounds',
  'storybook/outline',
  'storybook/viewport',
  'storybook/actions',
  'storybook/component-testing',
  'storybook/docgen',
  'storybook/review',
  'storybook/controls',
];

const managers = (features: StorybookFeatures): string[] =>
  builtInAddons
    .filter((addon) => addon.manager && isManagerEnabled(addon, features))
    .map((addon) => addon.meta.name);

describe('built-in addons', () => {
  it.each(builtInAddons.map((addon) => [addon.meta.name, addon] as const))(
    '%s declares an addon contribution',
    (_name, addon) => {
      expect(addon.meta.name).toMatch(/^storybook\//);
      expect(addon.meta.kind).toBe('addon');
      expect(addon.setup).toEqual(expect.any(Function));
      if (addon.manager) {
        expect(addon.meta.order).toEqual(expect.any(Number));
      }
    }
  );

  it.each([
    { name: 'the defaults', input: FEATURE_DEFAULTS, expected: MANAGERS_ON_BY_DEFAULT },
    {
      name: 'the manifest flag',
      input: { ...FEATURE_DEFAULTS, componentsManifest: true },
      expected: MANAGERS_ON_BY_DEFAULT,
    },
    {
      name: 'no flags',
      input: {},
      expected: ['storybook/docgen', 'storybook/review'],
    },
    {
      name: 'every UI flag off',
      input: {
        ...FEATURE_DEFAULTS,
        actions: false,
        backgrounds: false,
        controls: false,
        highlight: false,
        interactions: false,
        measure: false,
        outline: false,
        viewport: false,
      },
      expected: ['storybook/docgen', 'storybook/review'],
    },
    {
      name: 'actions and controls off',
      input: { ...FEATURE_DEFAULTS, actions: false, controls: false },
      expected: MANAGERS_ON_BY_DEFAULT.filter(
        (name) => name !== 'storybook/actions' && name !== 'storybook/controls'
      ),
    },
  ])('ships the built-in managers for $name', ({ input, expected }) => {
    expect(managers(input)).toEqual(expected);
  });
});
