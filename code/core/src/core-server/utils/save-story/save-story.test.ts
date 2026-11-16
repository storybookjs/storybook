import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel } from 'storybook/internal/channels';
import { formatFileContent } from 'storybook/internal/common';
import type { ResponseData, SaveStoryResponsePayload } from 'storybook/internal/core-events';
import {
  SAVE_STORY_REQUEST,
  SAVE_STORY_RESPONSE,
  STORY_RENDERED,
} from 'storybook/internal/core-events';
import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import { initializeSaveStory } from './save-story.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

const importPath = relative(process.cwd(), join(__dirname, 'mocks/csf-variances.stories.tsx'));

function saveStory(payload: { args?: string; name?: string; csfId?: string }) {
  const channel = new Channel({});
  initializeSaveStory(channel, {} as Options);
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
    vi.mocked(formatFileContent).mockRestore();
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
          /export const NewStory = \{\s+args: \{ class: "primary", nested: \{ "not-an-identifier": 1 \} \},/
        ),
      },
    });
  });

  it('writes a function arg as an empty arrow function on one line without a formatter', async () => {
    vi.mocked(formatFileContent).mockImplementation(async (_, content) => content);

    const response = await saveStory({
      args: JSON.stringify({ absolute: true, onClick: '__sb_empty_function_arg__' }),
    });

    expect(response).toMatchObject({
      success: true,
      payload: { sourceFileContent: expect.stringContaining('onClick: () => {},') },
    });
  });

  it('shows why a save is refused, and logs the diagnostic behind it', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(
      [
        `export default { title: 'X' };`,
        `const shared = { a: 1 };`,
        `export const A = { args: shared };`,
        `export const B = { args: shared };`,
      ].join('\n')
    );

    const response = await saveStory({ csfId: 'x--a', args: JSON.stringify({ a: 2 }) });

    expect(response).toMatchObject({
      success: false,
      error:
        'Cannot save arg "a" of story A because the args of the story are not an object written in the story itself, for example a constant that other stories share.',
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Caused by: Cannot mutate args.a because the target contains unsupported member'
      )
    );
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('refuses a new story whose name the file already uses', async () => {
    const response = await saveStory({ args: '{}', name: 'MyComponent' });

    expect(response).toMatchObject({
      success: false,
      error:
        'Cannot create story MyComponent because the file already uses the name MyComponent. Choose another name.',
    });
    expect(writeFile).not.toHaveBeenCalled();
  });
});
