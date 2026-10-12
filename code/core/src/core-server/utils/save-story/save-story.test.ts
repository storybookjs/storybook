import { writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel } from '@storybook/core/channels';
import type { Options } from '@storybook/core/types';

import type { ResponseData, SaveStoryResponsePayload } from '@storybook/core/core-events';
import {
  SAVE_STORY_REQUEST,
  SAVE_STORY_RESPONSE,
  STORY_RENDERED,
} from '@storybook/core/core-events';

import { initializeSaveStory } from './save-story';

vi.mock('node:fs/promises', { spy: true });
vi.mock('@storybook/core/telemetry', { spy: true });
vi.mock('@storybook/core/node-logger', { spy: true });

const importPath = relative(process.cwd(), join(__dirname, 'mocks/csf-variances.stories.tsx'));

function saveStory(payload: { args?: string; name?: string }) {
  const channel = new Channel({});
  initializeSaveStory(channel, {} as Options, { disableTelemetry: true });
  vi.mocked(writeFile).mockImplementation(async () => channel.emit(STORY_RENDERED));

  return new Promise<ResponseData<SaveStoryResponsePayload>>((resolve) => {
    channel.on(SAVE_STORY_RESPONSE, resolve);
    channel.emit(SAVE_STORY_REQUEST, {
      id: 'request',
      payload: { csfId: 'csf-variances--only-args', importPath, ...payload },
    });
  });
}

describe('save-story', () => {
  beforeEach(() => {
    vi.mocked(writeFile).mockReset();
  });

  it('rejects a story name that is not a valid identifier', async () => {
    const response = await saveStory({
      args: '{}',
      name: 'Pwned = globalThis.alert(1); export const Other',
    });

    expect(response).toMatchObject({
      success: false,
      error: expect.stringMatching(/^Invalid story name/),
    });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('rejects a story name that is a reserved word', async () => {
    const response = await saveStory({ args: '{}', name: 'default' });

    expect(response).toMatchObject({
      success: false,
      error: expect.stringMatching(/^Invalid story name/),
    });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('rejects a top-level arg name that is not a valid identifier', async () => {
    const response = await saveStory({
      args: JSON.stringify({ 'x: globalThis.alert(1), y': true }),
    });

    expect(response).toMatchObject({
      success: false,
      error: expect.stringMatching(/^Invalid arg name/),
    });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('saves a new story with identifier names, including reserved words as arg names', async () => {
    const response = await saveStory({
      args: JSON.stringify({ class: 'primary', nested: { 'not-an-identifier': 1 } }),
      name: 'NewStory',
    });

    expect(response).toMatchObject({
      success: true,
      payload: {
        sourceFileContent: expect.stringMatching(
          /export const NewStory = \{\s+args: \{\s+class: ['"]primary['"],\s+nested: \{\s+['"]not-an-identifier['"]: 1,/
        ),
      },
    });
  });
});
