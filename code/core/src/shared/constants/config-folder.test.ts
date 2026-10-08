import { join, resolve } from 'pathe';

import { describe, expect, it } from 'vitest';

import { storybookConfigExtensions } from './extensions.ts';
import {
  applyPreviewImportsMap,
  DOCUMENTED_PREVIEW_IMPORT,
  hasSiblingReactNativeConfig,
  isReactNativeStorybookPath,
  previewFileForImports,
  webPreviewCandidates,
} from './config-folder.ts';

describe('isReactNativeStorybookPath', () => {
  it('matches .rnstorybook config files and directories', () => {
    expect(isReactNativeStorybookPath('.rnstorybook')).toBe(true);
    expect(isReactNativeStorybookPath('.rnstorybook/preview.tsx')).toBe(true);
    expect(isReactNativeStorybookPath('/project/.rnstorybook/preview.ts')).toBe(true);
    expect(isReactNativeStorybookPath('C:\\project\\.rnstorybook\\preview.tsx')).toBe(true);
    expect(isReactNativeStorybookPath('.storybook/preview.ts')).toBe(false);
    expect(isReactNativeStorybookPath(undefined)).toBe(false);
  });
});

describe('webPreviewCandidates', () => {
  it('lists .storybook preview files next to .rnstorybook', () => {
    const projectDir = resolve('app');

    expect(webPreviewCandidates(join('app', '.rnstorybook', 'preview.tsx'))).toEqual(
      storybookConfigExtensions.map((extension) =>
        join(projectDir, '.storybook', `preview${extension}`)
      )
    );
  });
});

describe('hasSiblingReactNativeConfig', () => {
  it('detects .rnstorybook beside the config directory', () => {
    const configDir = join('apps', 'mobile', '.storybook');
    const sibling = join(resolve('apps', 'mobile'), '.rnstorybook');

    expect(hasSiblingReactNativeConfig(configDir, (file) => file === sibling)).toBe(true);
    expect(hasSiblingReactNativeConfig(configDir, () => false)).toBe(false);
    expect(hasSiblingReactNativeConfig(undefined, () => true)).toBe(false);
  });
});

describe('previewFileForImports', () => {
  it('prefers an existing web preview over the native file', () => {
    const nativePreview = join('app', '.rnstorybook', 'preview.tsx');
    const webPreview = join(resolve('app'), '.storybook', 'preview.ts');

    expect(previewFileForImports(nativePreview, (file) => file === webPreview)).toBe(webPreview);
    expect(previewFileForImports(nativePreview, () => false)).toBe(nativePreview);
  });
});

describe('applyPreviewImportsMap', () => {
  it('writes the documented specifier relative to the package directory', () => {
    const packageJson: { imports?: Record<string, unknown> } = {};
    const fromDirectory = join('repo');
    const previewFile = join('repo', 'apps', 'mobile', '.rnstorybook', 'preview.ts');

    expect(applyPreviewImportsMap(packageJson, previewFile, fromDirectory)).toBe(true);
    expect(packageJson.imports?.[DOCUMENTED_PREVIEW_IMPORT]).toBe(
      './apps/mobile/.rnstorybook/preview.ts'
    );
  });

  it('does not rewrite a mapping that already points at the same file', () => {
    const fromDirectory = join('app');
    const previewFile = join('app', '.rnstorybook', 'preview.tsx');
    const packageJson = {
      imports: {
        [DOCUMENTED_PREVIEW_IMPORT]: './.rnstorybook/preview.tsx',
        '#*': ['./*'],
      },
    };

    expect(applyPreviewImportsMap(packageJson, previewFile, fromDirectory)).toBe(false);
    expect(packageJson.imports['#*']).toEqual(['./*']);
  });
});
