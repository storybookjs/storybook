// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CalledPreviewMethodBeforeInitializationError } from 'storybook/internal/preview-errors';
import type { Renderer } from 'storybook/internal/types';

import { addons } from '../addons/index.ts';
import { Preview } from './Preview.tsx';
import { DocsContext } from './docs-context/DocsContext.ts';
import { getProjectAnnotations, importFn, mockChannel, storyIndex } from './PreviewWeb.mockdata.ts';

let mockFetchResult: any;
vi.mock('@storybook/global', async (importOriginal) => ({
  global: {
    ...(await importOriginal<typeof import('@storybook/global')>),
    fetch: async () => mockFetchResult,
  },
}));

vi.mock('storybook/internal/client-logger');

async function createInitializedPreview() {
  const preview = new Preview<Renderer>(importFn, getProjectAnnotations);
  await preview.ready();
  return preview;
}

beforeEach(() => {
  mockChannel.emit.mockClear();
  addons.setChannel(mockChannel as any);
  mockFetchResult = { status: 200, json: () => storyIndex, text: () => 'error text' };
});

describe('Preview.createDocsContext', () => {
  it('throws before the preview is initialized', async () => {
    const preview = new Preview<Renderer>(
      importFn,
      getProjectAnnotations,
      mockChannel as any,
      false
    );

    await expect(preview.createDocsContext(['./src/ComponentOne.stories.js'])).rejects.toThrow(
      CalledPreviewMethodBeforeInitializationError
    );
  });

  it('returns a DocsContext with the stories of the given CSF import paths', async () => {
    const preview = await createInitializedPreview();

    const docsContext = await preview.createDocsContext(['./src/ComponentOne.stories.js']);

    expect(docsContext).toBeInstanceOf(DocsContext);
    expect(docsContext.componentStories().map((story) => story.id)).toEqual([
      'component-one--a',
      'component-one--b',
    ]);
  });

  it('can resolve multiple CSF import paths', async () => {
    const preview = await createInitializedPreview();

    const docsContext = await preview.createDocsContext([
      './src/ComponentOne.stories.js',
      './src/ComponentTwo.stories.js',
    ]);

    expect(docsContext.componentStories().map((story) => story.id)).toEqual([
      'component-one--a',
      'component-one--b',
    ]);
  });

  it('does not attach the first CSF file when attach is false', async () => {
    const preview = await createInitializedPreview();

    const docsContext = await preview.createDocsContext(['./src/ComponentOne.stories.js'], {
      attach: false,
    });

    expect(docsContext).toBeInstanceOf(DocsContext);
    expect(docsContext.componentStories()).toEqual([]);
  });

  it('throws a clear error for a missing CSF import path', async () => {
    const preview = await createInitializedPreview();

    await expect(preview.createDocsContext(['./src/DoesNotExist.stories.js'])).rejects.toThrow(
      "Couldn't find story file at ./src/DoesNotExist.stories.js"
    );
  });
});
