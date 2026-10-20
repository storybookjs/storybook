import { describe, expect, it, vi } from 'vitest';

import type { StoryIndexGenerator } from 'storybook/internal/core-server';
import type { Options, StoryIndex } from 'storybook/internal/types';

import type { ViteDevServer } from 'vite';

import { SB_VIRTUAL_FILES, getResolvedVirtualModuleId } from '../virtual-file-names.ts';
import { codeGeneratorPlugin } from './code-generator-plugin.ts';

const storiesFileId = getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_STORIES_FILE);

/** A story index with one story per entry, in the order given. */
const storyIndex = (stories: Record<string, string>): StoryIndex => ({
  v: 5,
  entries: Object.fromEntries(
    Object.entries(stories).map(([id, importPath]) => [
      id,
      { type: 'story', subtype: 'story', id, name: id, title: 'Example', importPath, tags: [] },
    ])
  ),
});

const button = { 'example--button': './src/Button.stories.ts' };
const header = { 'example--header': './src/Header.stories.ts' };
const footer = { 'example--footer': './src/Footer.stories.ts' };

async function configurePlugin(index: StoryIndex) {
  let onInvalidated: () => Promise<void> = async () => {};
  const getIndex = vi.fn(async () => index);
  const storyIndexGenerator = {
    getIndex,
    onInvalidated: (listener: () => Promise<void>) => {
      onInvalidated = listener;
    },
  } as unknown as StoryIndexGenerator;
  const options = {
    presets: {
      apply: async (name: string) =>
        name === 'storyIndexGenerator' ? storyIndexGenerator : undefined,
    },
  } as unknown as Options;

  const plugin = codeGeneratorPlugin(options);
  const inEnvironment = (name: string) =>
    ({ environment: { name } }) as ThisParameterType<typeof plugin.load>;
  const watcher = { emit: vi.fn() };
  await plugin.configureServer.call(inEnvironment('client'), {
    watcher,
  } as unknown as ViteDevServer);

  return {
    getIndex,
    watcher,
    loadStoriesFile: (environment = 'client') =>
      plugin.load.call(inEnvironment(environment), storiesFileId),
    invalidateIndex: () => onInvalidated(),
  };
}

describe('codeGeneratorPlugin', () => {
  it('asks Vite for no reload before an environment loaded the stories file', async () => {
    const plugin = await configurePlugin(storyIndex(button));

    plugin.getIndex.mockResolvedValue(storyIndex({ ...button, ...header }));
    await plugin.invalidateIndex();

    expect(plugin.getIndex).not.toHaveBeenCalled();
    expect(plugin.watcher.emit).not.toHaveBeenCalled();
  });

  it('asks Vite for no reload when the set of story files is unchanged', async () => {
    const plugin = await configurePlugin(storyIndex(button));
    await plugin.loadStoriesFile();

    plugin.getIndex.mockResolvedValue(
      storyIndex({ 'example--renamed': './src/Button.stories.ts' })
    );
    await plugin.invalidateIndex();

    expect(plugin.watcher.emit).not.toHaveBeenCalled();
  });

  it('asks Vite for no reload when only the order of the story files changes', async () => {
    const plugin = await configurePlugin(storyIndex({ ...button, ...header }));
    await plugin.loadStoriesFile();

    plugin.getIndex.mockResolvedValue(storyIndex({ ...header, ...button }));
    await plugin.invalidateIndex();

    expect(plugin.watcher.emit).not.toHaveBeenCalled();
  });

  it('asks Vite for no reload when Vite already loaded the new set of story files', async () => {
    const plugin = await configurePlugin(storyIndex(button));
    await plugin.loadStoriesFile();

    plugin.getIndex.mockResolvedValue(storyIndex({ ...button, ...header }));
    await plugin.loadStoriesFile();
    await plugin.invalidateIndex();

    expect(plugin.watcher.emit).not.toHaveBeenCalled();
  });

  it('reloads the stories file when a story file is added', async () => {
    const plugin = await configurePlugin(storyIndex(button));
    await plugin.loadStoriesFile();

    plugin.getIndex.mockResolvedValue(storyIndex({ ...button, ...header }));
    await plugin.invalidateIndex();

    expect(plugin.watcher.emit).toHaveBeenCalledExactlyOnceWith('change', storiesFileId);
  });

  it('reloads the stories file when a story file is removed', async () => {
    const plugin = await configurePlugin(storyIndex({ ...button, ...header }));
    await plugin.loadStoriesFile();

    plugin.getIndex.mockResolvedValue(storyIndex(button));
    await plugin.invalidateIndex();

    expect(plugin.watcher.emit).toHaveBeenCalledExactlyOnceWith('change', storiesFileId);
  });

  it('reloads the stories file when an environment still has the old set of story files', async () => {
    const plugin = await configurePlugin(storyIndex(button));
    await plugin.loadStoriesFile('client');
    await plugin.loadStoriesFile('ssr');

    plugin.getIndex.mockResolvedValue(storyIndex({ ...button, ...header }));
    await plugin.loadStoriesFile('client');
    await plugin.invalidateIndex();

    expect(plugin.watcher.emit).toHaveBeenCalledExactlyOnceWith('change', storiesFileId);
  });

  it('does not ask again for an environment that has not loaded the stories file since', async () => {
    const plugin = await configurePlugin(storyIndex(button));
    await plugin.loadStoriesFile('client');
    await plugin.loadStoriesFile('ssr');
    plugin.getIndex.mockResolvedValue(storyIndex({ ...button, ...header }));
    await plugin.invalidateIndex();
    await plugin.loadStoriesFile('client');

    plugin.getIndex.mockResolvedValue(
      storyIndex({ ...button, 'example--renamed': './src/Header.stories.ts' })
    );
    await plugin.invalidateIndex();

    expect(plugin.watcher.emit).toHaveBeenCalledOnce();
  });

  it('compares with a load in progress once it has its code', async () => {
    const plugin = await configurePlugin(storyIndex(button));
    await plugin.loadStoriesFile();
    plugin.getIndex.mockResolvedValue(storyIndex({ ...button, ...header }));
    await plugin.invalidateIndex();

    // Vite loads the stories file again and reads the index before the next story file is added.
    let readIndex!: (index: StoryIndex) => void;
    plugin.getIndex.mockReturnValueOnce(new Promise((resolve) => (readIndex = resolve)));
    const load = plugin.loadStoriesFile();
    plugin.getIndex.mockResolvedValue(storyIndex({ ...button, ...header, ...footer }));
    const check = plugin.invalidateIndex();
    readIndex(storyIndex({ ...button, ...header }));
    await Promise.all([load, check]);

    expect(plugin.watcher.emit).toHaveBeenCalledTimes(2);
  });

  it('reloads the stories file when the index fails, so Vite reports the error', async () => {
    const plugin = await configurePlugin(storyIndex(button));
    await plugin.loadStoriesFile();

    plugin.getIndex.mockRejectedValue(new Error('Unable to index ./src/Button.stories.ts'));
    await plugin.invalidateIndex();

    expect(plugin.watcher.emit).toHaveBeenCalledExactlyOnceWith('change', storiesFileId);
  });

  it('reloads the stories file after its last load failed', async () => {
    const plugin = await configurePlugin(storyIndex(button));
    await plugin.loadStoriesFile();
    plugin.getIndex.mockRejectedValueOnce(new Error('Unable to index ./src/Button.stories.ts'));
    await expect(plugin.loadStoriesFile()).rejects.toThrow();

    await plugin.invalidateIndex();

    expect(plugin.watcher.emit).toHaveBeenCalledExactlyOnceWith('change', storiesFileId);
  });
});
