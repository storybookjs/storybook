// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import React from 'react';

import { Channel } from 'storybook/internal/channels';
import type { CSFFile, PreparedStory, Renderer } from 'storybook/internal/types';

import { DocsContext as DocsContextImpl } from 'storybook/preview-api';
import { ThemeProvider, convert, themes } from 'storybook/theming';

import { Canvas } from './Canvas.tsx';
import { DocsContext } from './DocsContext.ts';

type Store = ConstructorParameters<typeof DocsContextImpl<Renderer>>[1];
const storyFixture = (metaId: string, source: string) => {
  const moduleExport = {};
  const story = {
    id: `${metaId}--story`,
    name: 'Story',
    moduleExport,
    parameters: { docs: { story: { inline: true }, source: { originalSource: source } } },
  } as unknown as PreparedStory;
  const csfFile = {
    meta: { id: metaId, title: metaId },
    stories: { [story.id]: { id: story.id, moduleExport } },
    moduleExports: { Story: moduleExport },
  } as unknown as CSFFile;
  return { story, csfFile };
};

const attached = storyFixture('attached', '<AttachedStory />');
const other = storyFixture('other-package', '<OtherPackageStory />');

afterEach(() => cleanup());

it('renders a story by id, with its source, whose CSF file the docs entry does not import', async () => {
  const fixtures = [attached, other];
  const fixtureOf = (csfFile: CSFFile) => fixtures.find((f) => f.csfFile === csfFile)!;
  const store = {
    loadCSFFileByStoryId: async (id: string) => fixtures.find((f) => f.story.id === id)!.csfFile,
    storyFromCSFFile: ({ csfFile }: { csfFile: CSFFile }) => fixtureOf(csfFile).story,
    componentStoriesFromCSFFile: ({ csfFile }: { csfFile: CSFFile }) => [fixtureOf(csfFile).story],
    getStoryContext: (story: PreparedStory) => ({ parameters: story.parameters, unmappedArgs: {} }),
  };
  const renderStoryToElement = vi.fn(() => async () => {});
  const context = new DocsContextImpl<Renderer>(
    new Channel({}),
    store as unknown as Store,
    renderStoryToElement,
    [attached.csfFile]
  );
  context.attachCSFFile(attached.csfFile);

  render(
    <ThemeProvider theme={convert(themes.light)}>
      <DocsContext.Provider value={context}>
        <Canvas id="other-package--story" sourceState="shown" />
      </DocsContext.Provider>
    </ThemeProvider>
  );

  expect(await screen.findByText(/OtherPackageStory/)).toBeTruthy();
  expect(screen.queryByText(/AttachedStory/)).toBeNull();
  expect(renderStoryToElement).toHaveBeenCalledWith(
    other.story,
    expect.anything(),
    expect.anything(),
    expect.anything()
  );
});
