import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { cache, JsPackageManagerFactory, PackageManagerName } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';
import { SupportedRenderer } from 'storybook/internal/types';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fs, vol } from 'memfs';

import { getProjectInfo, type ProjectInfo } from '../skills/project-info.ts';
import { aiSetup } from './index.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });
vi.mock('../skills/project-info.ts', () => ({ getProjectInfo: vi.fn() }));

const projectInfo: ProjectInfo = {
  storybookVersion: '11.0.0-alpha.1',
  majorVersion: 11,
  framework: '@storybook/react-vite',
  rendererPackage: '@storybook/react',
  renderer: SupportedRenderer.REACT,
  builderPackage: '@storybook/builder-vite',
  addons: [],
  configDir: '.storybook',
  storiesPaths: [],
  language: 'ts',
  packageManager: JsPackageManagerFactory.getPackageManager({ force: PackageManagerName.NPM }),
  packageManagerName: 'npm',
  hasCsfFactoryPreview: false,
  needsUserOnboarding: false,
  monorepoType: undefined,
};

beforeEach(() => {
  vol.reset();
  vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as unknown as typeof writeFile);
  vi.mocked(telemetry).mockResolvedValue(undefined);
  vi.mocked(getProjectInfo).mockResolvedValue({ ok: true, projectInfo });
  vi.spyOn(cache, 'set').mockResolvedValue(undefined);
  vi.spyOn(logger, 'log').mockImplementation(() => {});
  vi.spyOn(logger, 'error').mockImplementation(() => {});
  vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  vi.stubEnv('EVAL_SETUP_PROMPT', '');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('aiSetup', () => {
  it.each([
    ['@storybook/angular-vite', SupportedRenderer.ANGULAR, '@storybook/builder-vite'],
    ['@storybook/angular', SupportedRenderer.ANGULAR, '@storybook/builder-webpack5'],
    ['@storybook/vue3-vite', SupportedRenderer.VUE3, '@storybook/builder-vite'],
    ['@storybook/react-vite', SupportedRenderer.REACT, '@storybook/builder-vite'],
    ['@storybook/react-webpack5', SupportedRenderer.REACT, '@storybook/builder-webpack5'],
  ] as const)('prints setup instructions for %s', async (framework, renderer, builderPackage) => {
    vi.mocked(getProjectInfo).mockResolvedValue({
      ok: true,
      projectInfo: {
        ...projectInfo,
        framework,
        renderer,
        rendererPackage: `@storybook/${renderer}`,
        builderPackage,
      },
    });

    await aiSetup({ runId: 'setup-test' });

    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('# Storybook Setup'));
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining(framework));
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining(`renderer=${renderer}`)
    );
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining('Use `npx storybook skills setup` instead.')
    );
    expect(process.stdout.write).not.toHaveBeenCalledWith(expect.stringContaining('deprecated'));
    expect(cache.set).toHaveBeenCalledWith('ai-setup-ran', {
      timestamp: expect.any(Number),
      runId: 'setup-test',
      configDir: resolve('.storybook'),
    });
    expect(telemetry).toHaveBeenCalledWith(
      'ai-setup',
      expect.objectContaining({
        project: expect.objectContaining({ framework, renderer: `@storybook/${renderer}` }),
      })
    );
    if (renderer !== SupportedRenderer.REACT) {
      expect(process.stdout.write).not.toHaveBeenCalledWith(
        expect.stringMatching(/\breact\b|jsx|tsx|<Story|SessionProvider/i)
      );
    }
  });

  it.each([
    ['@storybook/angular-vite', SupportedRenderer.ANGULAR],
    ['@storybook/vue3-vite', SupportedRenderer.VUE3],
  ] as const)(
    'writes %s setup instructions to the requested output file',
    async (framework, renderer) => {
      vi.mocked(getProjectInfo).mockResolvedValue({
        ok: true,
        projectInfo: {
          ...projectInfo,
          framework,
          renderer,
          rendererPackage: `@storybook/${renderer}`,
        },
      });
      const output = resolve('setup.md');
      vol.fromJSON({ [output]: '' });

      await aiSetup({ runId: 'setup-test', output });

      const markdown = fs.readFileSync(output, 'utf8');
      expect(markdown).toContain('# Storybook Setup');
      expect(markdown).toContain(framework);
      expect(markdown).toContain('preview.ts');
      expect(markdown).not.toMatch(/\breact\b|jsx|tsx|<Story|SessionProvider/i);
      expect(process.stdout.write).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith(`Prompt written to ${output}`);
    }
  );

  it.each([
    '@storybook/svelte',
    '@storybook/preact',
    '@storybook/html',
    '@storybook/web-components',
    '@storybook/solid',
    '@storybook/react-native',
    '@custom/renderer',
    null,
  ])('rejects unsupported renderer %s without writing instructions', async (rendererPackage) => {
    vi.mocked(getProjectInfo).mockResolvedValue({
      ok: true,
      projectInfo: { ...projectInfo, rendererPackage },
    });

    vol.fromJSON({ [resolve('setup.md')]: '' });

    await aiSetup({ runId: 'setup-test', output: resolve('setup.md') });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('only available for React, Angular, and Vue projects')
    );
    expect(process.stdout.write).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
    expect(telemetry).not.toHaveBeenCalled();
  });

  it('reports project detection failures without emitting setup instructions', async () => {
    vi.mocked(getProjectInfo).mockResolvedValue({
      ok: false,
      message: 'Could not detect framework',
    });

    await aiSetup({ runId: 'setup-test' });

    expect(logger.error).toHaveBeenCalledWith('Could not detect framework');
    expect(process.stdout.write).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
    expect(telemetry).not.toHaveBeenCalled();
  });
});
