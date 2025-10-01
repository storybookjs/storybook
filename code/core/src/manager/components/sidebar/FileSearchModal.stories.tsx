import React from 'react';

import { ModalDecorator } from 'storybook/internal/components';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, fireEvent, fn, within } from 'storybook/test';

import { WithResults } from './FileSearchList.stories';
import { FileSearchModal } from './FileSearchModal';

const meta = {
  component: FileSearchModal,
  title: 'Sidebar/FileSearchModal',
  args: {
    open: true,
    setError: fn(),
    onCreateNewStory: fn(),
    onOpenChange: fn(),
    setFileSearchQuery: fn(),
  },
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [ModalDecorator],
} satisfies Meta<typeof FileSearchModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InitialState: Story = {
  args: {
    fileSearchQuery: '',
    fileSearchQueryDeferred: '',
    isLoading: false,
    error: null,
    searchResults: null,
  },
};

export const Loading: Story = {
  args: {
    fileSearchQuery: 'src',
    fileSearchQueryDeferred: 'src',
    isLoading: true,
    error: null,
    searchResults: null,
  },
};

export const LoadingWithPreviousResults: Story = {
  args: {
    fileSearchQuery: 'src',
    fileSearchQueryDeferred: 'src',
    isLoading: true,
    error: null,
    searchResults: WithResults.args.searchResults,
  },
};

export const Empty: Story = {
  args: {
    fileSearchQuery: 'src',
    fileSearchQueryDeferred: 'src',
    isLoading: false,
    error: null,
    searchResults: [],
  },
};

export const WithSearchResults: Story = {
  args: {
    fileSearchQuery: 'src',
    fileSearchQueryDeferred: 'src',
    isLoading: false,
    error: null,
    searchResults: WithResults.args.searchResults,
  },
  play: async ({ canvasElement, args }) => {
    const parent = within(canvasElement.parentNode as HTMLElement);

    const moduleSingleExport = await parent.findByText(
      'module-single-export.js',
      {},
      { timeout: 3000 }
    );
    await fireEvent.click(moduleSingleExport);

    await expect(args.onCreateNewStory).toHaveBeenCalledWith({
      componentExportCount: 1,
      componentExportName: 'default',
      componentFilePath: 'src/module-single-export.js',
      componentIsDefaultExport: true,
      selectedItemId: 'src/module-single-export.js',
    });
  },
};

export const WithSearchResultsAndError: Story = {
  args: {
    fileSearchQuery: 'src',
    fileSearchQueryDeferred: 'src',
    isLoading: false,
    error: { error: 'Some error occured', selectedItemId: 'src/module-multiple-exports.js' },
    searchResults: WithResults.args.searchResults,
  },
};

export const WithSearchResultsAndMultiLineError: Story = {
  args: {
    fileSearchQuery: 'src',
    fileSearchQueryDeferred: 'src',
    isLoading: false,
    error: {
      error: 'A very long error occured. A very long error occured. A very long error occured.',
      selectedItemId: 'src/module-multiple-exports.js',
    },
    searchResults: WithResults.args.searchResults,
  },
};
