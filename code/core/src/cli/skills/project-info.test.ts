import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportedLanguage } from 'storybook/internal/types';

import * as detectLanguageModule from '../detectLanguage.ts';
import { getStorybookData } from '../getStorybookData.ts';
import { getProjectInfo } from './project-info.ts';

vi.mock('../getStorybookData.ts', { spy: true });
vi.mock('../detectLanguage.ts', { spy: true });

const storybookData = {
  configDir: '.storybook',
  workingDir: '/fake/project',
  mainConfig: { stories: [] },
  mainConfigPath: '/fake/project/.storybook/main.ts',
  previewConfigPath: undefined,
  packageManager: { type: 'yarn1' },
  storiesPaths: [],
  versionInstalled: '9.0.0',
  hasCsfFactoryPreview: false,
  frameworkPackage: '@storybook/react-vite',
  rendererPackage: '@storybook/react',
  renderer: 'react',
  builderPackage: '@storybook/builder-vite',
  addons: [],
} as any;

describe('getProjectInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStorybookData).mockResolvedValue(storybookData);
    vi.mocked(detectLanguageModule.detectLanguage).mockResolvedValue(SupportedLanguage.TYPESCRIPT);
  });

  it('suppresses the Yarn 1 best-effort warning for agent-facing output', async () => {
    const result = await getProjectInfo({ configDir: '.storybook' });

    expect(result.ok).toBe(true);
    expect(vi.mocked(getStorybookData)).toHaveBeenCalledWith(
      expect.objectContaining({ warnOnYarn1: false })
    );
  });
});
