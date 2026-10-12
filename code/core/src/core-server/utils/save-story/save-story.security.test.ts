import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel } from '@storybook/core/channels';
import { getProjectRoot } from '@storybook/core/common';
import type { Options } from '@storybook/core/types';

import type { ResponseData, SaveStoryResponsePayload } from '@storybook/core/core-events';
import {
  SAVE_STORY_REQUEST,
  SAVE_STORY_RESPONSE,
  STORY_RENDERED,
} from '@storybook/core/core-events';

import { initializeSaveStory } from './save-story';

vi.mock('node:fs/promises', { spy: true });
vi.mock('@storybook/core/common', { spy: true });
vi.mock('@storybook/core/telemetry', { spy: true });
vi.mock('@storybook/core/node-logger', { spy: true });

const mocksDir = join(__dirname, 'mocks');
const storyFile = join(mocksDir, 'csf-variances.stories.tsx');
// Lexical only: the handler joins importPath onto the cwd, so this directory need not exist.
const workingDir = join(mocksDir, 'project');

function saveStory(importPath: string) {
  const channel = new Channel({});
  initializeSaveStory(channel, {} as Options, { disableTelemetry: true });
  vi.mocked(writeFile).mockImplementation(async () => channel.emit(STORY_RENDERED));

  return new Promise<ResponseData<SaveStoryResponsePayload>>((resolve) => {
    channel.on(SAVE_STORY_RESPONSE, resolve);
    channel.emit(SAVE_STORY_REQUEST, {
      id: 'request',
      payload: { csfId: 'csf-variances--only-args', importPath, args: '{}' },
    });
  });
}

describe('save-story (security)', () => {
  let cwd: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(writeFile).mockReset();
    vi.mocked(readFile).mockClear();
    cwd = vi.spyOn(process, 'cwd').mockReturnValue(workingDir);
    vi.mocked(getProjectRoot).mockReturnValue(workingDir);
  });

  afterEach(() => {
    cwd.mockRestore();
  });

  it('rejects an importPath that traverses outside the project root', async () => {
    const response = await saveStory('../csf-variances.stories.tsx');

    expect(response).toMatchObject({
      success: false,
      error: 'Invalid importPath: must resolve within the project root.',
    });
    expect(readFile).not.toHaveBeenCalledWith(storyFile, expect.anything());
    expect(writeFile).not.toHaveBeenCalled();
  });

  it.each(['.../csf-variances.stories.tsx', 'stories/.../csf-variances.stories.tsx'])(
    'rejects an importPath with a dot-only segment: %s',
    async (importPath) => {
      const response = await saveStory(importPath);

      expect(response).toMatchObject({
        success: false,
        error: 'Invalid importPath: must resolve within the project root.',
      });
      expect(writeFile).not.toHaveBeenCalled();
    }
  );

  it('does not touch an absolute importPath outside the project root', async () => {
    const response = await saveStory(storyFile);

    expect(response.success).toBe(false);
    expect(readFile).not.toHaveBeenCalledWith(storyFile, expect.anything());
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('saves a story inside the project root that is outside the working directory', async () => {
    vi.mocked(getProjectRoot).mockReturnValue(mocksDir);

    const response = await saveStory('../csf-variances.stories.tsx');

    expect(response).toMatchObject({ success: true });
    expect(writeFile).toHaveBeenCalledWith(storyFile, expect.any(String));
  });
});
