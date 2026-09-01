import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizePath } from 'vite';

import { match } from 'micromatch';

import {
  getInterpretedFile,
  normalizeStories,
  optionalEnvToBoolean,
  resolvePathInStorybookCache,
  validateConfigurationFiles,
} from 'storybook/internal/common';
import { StoryIndexGenerator, experimental_loadStorybook } from 'storybook/internal/core-server';
import { vitestTransform } from 'storybook/internal/csf-tools';
import {
  isTelemetryModuleEnabled,
  oneWayHash,
  setTelemetryEnabled,
} from 'storybook/internal/telemetry';

import { withoutVitePlugins } from '../../../../builders/builder-vite/src/utils/without-vite-plugins.ts';
import { storybookTest } from './index.ts';
import { requiresProjectAnnotations } from './utils.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/core-server', { spy: true });
vi.mock('storybook/internal/csf-tools', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });
vi.mock('../../../../builders/builder-vite/src/utils/without-vite-plugins.ts', { spy: true });
vi.mock('./utils.ts', { spy: true });
vi.mock('./agent-telemetry-reporter.ts', { spy: true });

const escapeGlobPath = (filePath: string) =>
  filePath
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');

const stories = [
  '../storybook/**/*.stories.ts',
  '!../storybook/excluded/**/*.stories.ts',
  { directory: '../[stories]', files: '**/*.stories.ts' },
];
const presets = {
  apply: vi.fn(async (name: string, defaultValue?: unknown) => {
    if (name === 'stories') {
      return stories;
    }
    if (name === 'framework') {
      return { name: '@storybook/react-vite' };
    }
    return defaultValue;
  }),
};

describe('storybookTest', () => {
  beforeEach(() => {
    vi.stubEnv('VITEST', 'true');
    vi.mocked(getInterpretedFile).mockReturnValue(undefined);
    vi.mocked(normalizeStories).mockReturnValue([]);
    vi.mocked(optionalEnvToBoolean).mockImplementation((value) => value === 'true');
    vi.mocked(resolvePathInStorybookCache).mockReturnValue('/cache');
    vi.mocked(validateConfigurationFiles).mockResolvedValue(undefined);
    vi.mocked(StoryIndexGenerator.findMatchingFilesForSpecifiers).mockResolvedValue([]);
    vi.mocked(StoryIndexGenerator.storyFileNames).mockReturnValue([]);
    vi.mocked(experimental_loadStorybook).mockResolvedValue({ presets } as never);
    vi.mocked(vitestTransform).mockResolvedValue({ code: 'transformed' } as never);
    vi.mocked(isTelemetryModuleEnabled).mockReturnValue(false);
    vi.mocked(oneWayHash).mockReturnValue('project');
    vi.mocked(setTelemetryEnabled).mockResolvedValue(undefined);
    vi.mocked(withoutVitePlugins).mockImplementation(async (plugins) => plugins ?? []);
    vi.mocked(requiresProjectAnnotations).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('discovers stories when the config directory is nested below the Vitest root', async () => {
    const configDir = normalizePath(resolve('web/[project]/(marketing)/.storybook'));
    const storyGlob = escapeGlobPath(
      normalizePath(resolve('web/[project]/(marketing)/storybook/**/*.stories.ts'))
    );
    const excludedStoryGlob = `!${escapeGlobPath(
      normalizePath(resolve('web/[project]/(marketing)/storybook/excluded/**/*.stories.ts'))
    )}`;
    const objectStoryGlob = escapeGlobPath(
      normalizePath(resolve('web/[project]/(marketing)/[stories]/**/*.stories.ts'))
    );
    const story = normalizePath(resolve('web/[project]/(marketing)/storybook/Button.stories.ts'));
    const objectStory = normalizePath(
      resolve('web/[project]/(marketing)/[stories]/Button.stories.ts')
    );
    const excludedStory = normalizePath(
      resolve('web/[project]/(marketing)/storybook/excluded/Button.stories.ts')
    );

    const plugins = await storybookTest({ configDir });
    const plugin = plugins.find(({ name }) => name === 'vite-plugin-storybook-test');
    const configHook =
      typeof plugin?.config === 'function' ? plugin.config : plugin?.config?.handler;
    const transformHook =
      typeof plugin?.transform === 'function' ? plugin.transform : plugin?.transform?.handler;
    const config = await configHook?.call({} as never, {}, { mode: 'test' } as never);

    expect(config).toMatchObject({
      root: normalizePath(resolve('web/[project]/(marketing)')),
      test: { include: [storyGlob, excludedStoryGlob, objectStoryGlob] },
    });
    expect(match([story, objectStory, excludedStory], config?.test?.include ?? [])).toEqual([
      story,
      objectStory,
    ]);

    await transformHook?.call({} as never, 'export default {}', story);
    await transformHook?.call({} as never, 'export default {}', objectStory);

    expect(vi.mocked(vitestTransform)).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: story })
    );
    expect(vi.mocked(vitestTransform)).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: objectStory })
    );

    vi.mocked(vitestTransform).mockClear();
    await transformHook?.call({} as never, 'export default {}', excludedStory);

    expect(vi.mocked(vitestTransform)).not.toHaveBeenCalled();
  });
});
