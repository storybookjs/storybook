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
  addons: ['@storybook/addon-docs', '@storybook/addon-vitest'],
  configDir: '.storybook',
  storiesPaths: ['src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  packageManager: { type: 'npm' } as JsPackageManager,
  packageManagerName: 'npm',
  language: 'ts',
  hasCsfFactoryPreview: false,
  needsUserOnboarding: false,
};

const languages = ['ts', 'js'] as const;
const csfFactory = [false, true] as const;

describe('getAiSimpleSetupMarkdownOutput', () => {
  describe.each(languages)('language: %s', (language) => {
    it.each(csfFactory)('renders with csf-factory preview: %s', (hasCsfFactoryPreview) => {
      expect(
        getAiSimpleSetupMarkdownOutput({ ...baseProjectInfo, language, hasCsfFactoryPreview })
      ).toMatchSnapshot();
    });
  });
});
