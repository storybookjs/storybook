import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import { SupportedLanguage, SupportedRenderer } from 'storybook/internal/types';

import { detectLanguage } from '../detectLanguage.ts';
import { getStorybookData } from '../getStorybookData.ts';
import { resolveProjectInfo } from './project-info.ts';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('../getStorybookData.ts');
vi.mock('../detectLanguage.ts');

type StorybookData = Awaited<ReturnType<typeof getStorybookData>>;

const storybookData = {
  configDir: '.storybook',
  workingDir: '/project',
  versionInstalled: '10.5.2',
  frameworkPackage: '@storybook/react-vite',
  rendererPackage: '@storybook/react',
  renderer: SupportedRenderer.REACT,
  builderPackage: '@storybook/builder-vite',
  addons: ['@storybook/addon-docs'],
  storiesPaths: ['src/**/*.stories.tsx'],
  packageManager: { type: 'npm' },
  hasCsfFactoryPreview: false,
} as unknown as StorybookData;

describe('resolveProjectInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStorybookData).mockResolvedValue(storybookData);
    vi.mocked(detectLanguage).mockResolvedValue(SupportedLanguage.TYPESCRIPT);
  });

  it('maps the detected project data into ProjectInfo', async () => {
    const projectInfo = await resolveProjectInfo({
      needsUserOnboarding: async () => true,
    });

    expect(projectInfo).toEqual({
      storybookVersion: '10.5.2',
      majorVersion: 10,
      framework: '@storybook/react-vite',
      rendererPackage: '@storybook/react',
      renderer: SupportedRenderer.REACT,
      builderPackage: '@storybook/builder-vite',
      addons: ['@storybook/addon-docs'],
      configDir: '.storybook',
      storiesPaths: ['src/**/*.stories.tsx'],
      packageManager: storybookData.packageManager,
      packageManagerName: 'npm',
      language: 'ts',
      hasCsfFactoryPreview: false,
      needsUserOnboarding: true,
    });
  });

  it('defaults needsUserOnboarding to false when no resolver is given', async () => {
    const projectInfo = await resolveProjectInfo({});

    expect(projectInfo?.needsUserOnboarding).toBe(false);
  });

  it('returns undefined when framework, renderer, or builder cannot be detected', async () => {
    vi.mocked(getStorybookData).mockResolvedValue({
      ...storybookData,
      frameworkPackage: null,
    } as unknown as StorybookData);

    expect(await resolveProjectInfo({})).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Could not detect framework, renderer, or builder')
    );
  });

  it('returns undefined for projects that are not React + Vite', async () => {
    vi.mocked(getStorybookData).mockResolvedValue({
      ...storybookData,
      rendererPackage: '@storybook/vue3',
    } as unknown as StorybookData);

    expect(await resolveProjectInfo({})).toBeUndefined();
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('only available for projects using the React renderer')
    );
  });

  it('returns undefined when reading the Storybook configuration fails', async () => {
    vi.mocked(getStorybookData).mockRejectedValue(new Error('boom'));

    expect(await resolveProjectInfo({})).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to read Storybook configuration: boom')
    );
  });

  it('reports a failing needsUserOnboarding resolver as a configuration error', async () => {
    expect(
      await resolveProjectInfo({
        needsUserOnboarding: async () => {
          throw new Error('cache corrupted');
        },
      })
    ).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to read Storybook configuration: cache corrupted')
    );
  });
});
