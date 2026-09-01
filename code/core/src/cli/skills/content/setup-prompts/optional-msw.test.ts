import { describe, expect, it } from 'vitest';

import { NPMProxy } from '../../../../common/js-package-manager/NPMProxy.ts';
import type { ProjectInfo } from '../../project-info.ts';
import { getPreviewExample } from './partials/examples.ts';
import { instructions as optimizedInstructions } from './optimized-tests.ts';
import { instructions as patternCopyPlayInstructions } from './pattern-copy-play.ts';

const projectInfo = {
  storybookVersion: '10.6.0',
  majorVersion: 10,
  framework: '@storybook/react-vite',
  rendererPackage: '@storybook/react',
  renderer: 'react',
  builderPackage: '@storybook/builder-vite',
  addons: [],
  configDir: '.storybook',
  storiesPaths: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  language: 'ts',
  packageManager: new NPMProxy(),
  packageManagerName: 'npm',
  hasCsfFactoryPreview: true,
  needsUserOnboarding: false,
  monorepoType: undefined,
} satisfies ProjectInfo;

describe('optional MSW setup', () => {
  it('keeps MSW out of the base preview example', () => {
    expect(getPreviewExample(projectInfo)).not.toContain('msw');
  });

  it.each([
    ['optimized', optimizedInstructions],
    ['pattern-copy-play', patternCopyPlayInstructions],
  ])('makes MSW conditional in the %s prompt', (_, buildInstructions) => {
    const prompt = buildInstructions(projectInfo);

    expect(prompt).toContain(
      'Use this step only if the selected stories perform network or data fetching'
    );
    expect(prompt).toContain('create an empty handlers file');
    expect(prompt).toContain("import * as mswStorybookAddon from 'msw-storybook-addon/preview'");
  });
});
