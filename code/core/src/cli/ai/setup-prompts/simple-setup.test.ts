import { describe, expect, it } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { SupportedRenderer } from 'storybook/internal/types';

import type { ProjectInfo } from '../types.ts';
import { getAiSimpleSetupMarkdownOutput } from './simple-setup.ts';

const baseProjectInfo: ProjectInfo = {
  storybookVersion: '10.5.2',
  majorVersion: 10,
  framework: '@storybook/react-vite',
  rendererPackage: '@storybook/react',
  renderer: SupportedRenderer.REACT,
  builderPackage: '@storybook/builder-vite',
  addons: ['@storybook/addon-docs'],
  configDir: '.storybook',
  storiesPaths: ['src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  packageManager: { type: 'npm' } as JsPackageManager,
  packageManagerName: 'npm',
  language: 'ts',
  hasCsfFactoryPreview: false,
  needsUserOnboarding: false,
};

const variants: Array<[string, Partial<ProjectInfo>]> = [
  ['typescript', {}],
  ['javascript', { language: 'js' }],
  ['csf-factory', { hasCsfFactoryPreview: true }],
];

describe('getAiSimpleSetupMarkdownOutput', () => {
  describe.each(variants)('%s', (_name, overrides) => {
    it('renders without addon-vitest', () => {
      expect(
        getAiSimpleSetupMarkdownOutput({ ...baseProjectInfo, ...overrides })
      ).toMatchSnapshot();
    });

    it('renders with addon-vitest', () => {
      expect(
        getAiSimpleSetupMarkdownOutput({
          ...baseProjectInfo,
          ...overrides,
          addons: [...baseProjectInfo.addons, '@storybook/addon-vitest'],
        })
      ).toMatchSnapshot();
    });
  });
});
