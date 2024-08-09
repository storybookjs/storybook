import { expect, it, vi } from 'vitest';

import { Channel } from '@storybook/core/channels';
import type { DocsIndexEntry, RenderContextCallbacks, Renderer } from '@storybook/core/types';

import type { StoryStore } from '../../store';
import { csfFileParts } from '../docs-context/test-utils';
import { CsfDocsRender } from './CsfDocsRender';
import { PREPARE_ABORTED } from './Render';

const entry = {
  type: 'docs',
  id: 'component--docs',
  name: 'Docs',
  title: 'Component',
  importPath: './Component.stories.ts',
  storiesImports: [],
  tags: ['autodocs'],
} as DocsIndexEntry;

const createGate = (): [Promise<any | undefined>, (_?: any) => void] => {
  let openGate = (_?: any) => {};
  const gate = new Promise<any | undefined>((resolve) => {
    openGate = resolve;
  });
  return [gate, openGate];
};

it('throws PREPARE_ABORTED if torndown during prepare', async () => {
  const [importGate, openImportGate] = createGate();
  const mockStore = {
    loadEntry: vi.fn(async () => {
      await importGate;
      return {};
    }),
  };

  const render = new CsfDocsRender(
    new Channel({}),
    mockStore as unknown as StoryStore<Renderer>,
    entry,
    {} as RenderContextCallbacks<Renderer>
  );

  const preparePromise = render.prepare();

  render.teardown();

  openImportGate();

  await expect(preparePromise).rejects.toThrowError(PREPARE_ABORTED);
});

it('attached immediately', async () => {
  const { story, csfFile, moduleExports } = csfFileParts();

  const store = {
    loadEntry: () => ({
      entryExports: moduleExports,
      csfFiles: [],
    }),
    processCSFFileWithCache: () => csfFile,
    componentStoriesFromCSFFile: () => [story],
    storyFromCSFFile: () => story,
  } as unknown as StoryStore<Renderer>;

  const render = new CsfDocsRender(
    new Channel({}),
    store,
    entry,
    {} as RenderContextCallbacks<Renderer>
  );
  await render.prepare();

  const context = render.docsContext(vi.fn());

  expect(context.storyById()).toEqual(story);
});
