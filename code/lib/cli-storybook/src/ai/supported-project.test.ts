import { describe, expect, it } from 'vitest';

import {
  getUnsupportedAiSetupProjectMessage,
  isAiSetupSupportedProject,
} from './supported-project.ts';

describe('isAiSetupSupportedProject', () => {
  it('allows React projects using the Vite builder', () => {
    expect(
      isAiSetupSupportedProject({
        rendererPackage: '@storybook/react',
        builderPackage: '@storybook/builder-vite',
      })
    ).toBe(true);
  });

  it('allows React projects using the Rsbuild builder', () => {
    expect(
      isAiSetupSupportedProject({
        rendererPackage: '@storybook/react',
        builderPackage: 'storybook-builder-rsbuild',
      })
    ).toBe(true);
  });

  it('rejects non-React projects even when they use a supported builder', () => {
    expect(
      isAiSetupSupportedProject({
        rendererPackage: '@storybook/vue3',
        builderPackage: 'storybook-builder-rsbuild',
      })
    ).toBe(false);
  });

  it('rejects React projects using unsupported builders', () => {
    expect(
      isAiSetupSupportedProject({
        rendererPackage: '@storybook/react',
        builderPackage: '@storybook/builder-webpack5',
      })
    ).toBe(false);
  });
});

describe('getUnsupportedAiSetupProjectMessage', () => {
  it('lists the supported builder families and detected packages', () => {
    expect(
      getUnsupportedAiSetupProjectMessage({
        rendererPackage: '@storybook/react',
        builderPackage: '@storybook/builder-webpack5',
      })
    ).toBe(
      'AI-assisted setup is currently only available for projects using the React renderer with Vite or Rsbuild builders. Detected renderer: @storybook/react, builder: @storybook/builder-webpack5'
    );
  });
});
