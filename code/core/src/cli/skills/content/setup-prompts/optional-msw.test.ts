import { describe, expect, it } from 'vitest';
import type { JsPackageManager } from 'storybook/internal/common';
import { SupportedRenderer } from 'storybook/internal/types';

import type { ProjectInfo } from '../../project-info.ts';
import { getPreviewExample } from './partials/examples.ts';
import { instructions as optimizedInstructions } from './optimized-tests.ts';
import { instructions as patternCopyPlayInstructions } from './pattern-copy-play.ts';

const packageManager = {
  getInstallCommand: (deps: string[]) => `npm install --save-dev ${deps.join(' ')}`,
  getPackageCommand: (args: string[]) => `npx ${args.join(' ')}`,
  getRunCommand: (command: string) => `npm run ${command}`,
} as JsPackageManager;

const projectInfo = {
  storybookVersion: '10.6.0',
  majorVersion: 10,
  framework: '@storybook/react-vite',
  rendererPackage: '@storybook/react',
  renderer: SupportedRenderer.REACT,
  builderPackage: '@storybook/builder-vite',
  addons: [],
  configDir: '.storybook',
  storiesPaths: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  language: 'ts',
  packageManager,
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
    expect(prompt).toContain('addonMsw()');
    expect(prompt).toMatch(/[Mm]erge into the existing/);
    expect(prompt).toMatch(/do not replace/i);
  });

  it('tells CSF3 previews to append mswLoader instead of replacing the file', () => {
    const prompt = optimizedInstructions({ ...projectInfo, hasCsfFactoryPreview: false });

    expect(prompt).toContain('mswLoader()');
    expect(prompt).toMatch(/[Mm]erge into the existing/);
    expect(prompt).toContain('append mswLoader() to the existing loaders array');
  });
});
