import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, fireEvent, fn, within } from 'storybook/test';

import { FileSearchList } from './FileSearchList';

const meta = {
  component: FileSearchList,
  title: 'Sidebar/FileSearchList',
  args: {
    onNewStory: fn(),
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof FileSearchList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isLoading: true,
    searchResults: null,
    // @ts-expect-error (non strict)
    errorItemId: null,
  },
};

export const Empty: Story = {
  args: {
    isLoading: false,
    searchResults: [],
    // @ts-expect-error (non strict)
    errorItemId: null,
  },
};

export const WithResults: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const firstItem = await canvas.findByText('module-multiple-exports.js', {}, { timeout: 3000 });
    fireEvent.click(firstItem);

    const exportedElement1 = await canvas.findByText('module-multiple-exports');
    fireEvent.click(exportedElement1);

    expect(args.onNewStory).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItemId: 'src/module-multiple-exports.js_0',
        componentExportName: 'default',
        componentFilePath: 'src/module-multiple-exports.js',
        componentIsDefaultExport: true,
      })
    );

    const exportedElement2 = await canvas.findByText('namedExport');
    fireEvent.click(exportedElement2);

    expect(args.onNewStory).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItemId: 'src/module-multiple-exports.js_1',
        componentExportName: 'namedExport',
        componentFilePath: 'src/module-multiple-exports.js',
        componentIsDefaultExport: false,
      })
    );

    const singleExport = await canvas.findByText('module-single-export.js');
    fireEvent.click(singleExport);

    expect(args.onNewStory).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItemId: 'src/module-single-export.js',
        componentExportName: 'default',
        componentFilePath: 'src/module-single-export.js',
        componentIsDefaultExport: true,
      })
    );

    expect(args.onNewStory).toHaveBeenCalledTimes(3);

    const noExportsModule1 = await canvas.findByText('no-exports-module.js');
    fireEvent.click(noExportsModule1);

    expect(args.onNewStory).toHaveBeenCalledTimes(3);

    const noExportsModule2 = await canvas.findByText('no-exports-module-1.js');
    fireEvent.click(noExportsModule2);

    expect(args.onNewStory).toHaveBeenCalledTimes(3);
  },
  args: {
    isLoading: false,
    // @ts-expect-error (non strict)
    errorItemId: null,
    searchResults: [
      {
        exportedComponents: [],
        storyFileExists: false,
        filepath: 'src/no-exports-module.js',
      },
      {
        storyFileExists: false,
        exportedComponents: [
          {
            default: true,
            name: 'default',
          },
          {
            default: false,
            name: 'namedExport',
          },
        ],
        filepath: 'src/module-multiple-exports.js',
      },
      {
        storyFileExists: false,
        exportedComponents: null,
        filepath: 'src/no-exports-module-1.js',
      },
      {
        storyFileExists: false,
        exportedComponents: [
          {
            default: true,
            name: 'default',
          },
        ],
        filepath: 'src/module-single-export.js',
      },
      {
        storyFileExists: true,
        exportedComponents: [
          {
            default: true,
            name: 'default',
          },
          {
            default: false,
            name: 'namedExportWithStory',
          },
        ],
        filepath: 'src/has-story-file-with-multiple-exports.js',
      },
      {
        storyFileExists: true,
        exportedComponents: [
          {
            default: true,
            name: 'default',
          },
        ],
        filepath: 'src/has-story-file.js',
      },
    ],
  },
};
