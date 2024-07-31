import type { Meta, StoryObj } from '@storybook/react';
import { findByText, fireEvent, fn, expect } from '@storybook/test';
import { WithResults } from './FileSearchList.stories';
import React, { useState } from 'react';

import { FileSearchModal } from './FileSearchModal';

const meta = {
  component: FileSearchModal,
  args: {
    open: true,
    setError: fn(),
    onCreateNewStory: fn(),
    onOpenChange: fn(),
    setFileSearchQuery: fn(),
  },
  // This decorator is used to show the modal in the side by side view
  decorators: [
    (Story, context) => {
      const [container, setContainer] = useState<HTMLElement | null>(null);

      if (context.globals.theme === 'side-by-side') {
        return (
          <div
            ref={(element) => {
              setContainer(element);
            }}
            style={{
              width: '100%',
              height: '100%',
              minHeight: '600px',
              transform: 'translateZ(0)',
            }}
          >
            {/* @ts-expect-error (non strict) */}
            {Story({ args: { ...context.args, container } })}
          </div>
        );
      }

      return Story();
    },
  ],
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
    const parent = canvasElement.parentNode as HTMLElement;

    const moduleSingleExport = await findByText(parent, 'module-single-export.js');
    await fireEvent.click(moduleSingleExport);

    expect(args.onCreateNewStory).toHaveBeenCalledWith({
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
