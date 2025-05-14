
import type { Meta } from '@storybook/react-vite';
import { loader, render } from './loader';

export default {
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  loaders: [loader],
  render,
} satisfies Meta;

export const CLI = {
  args: {
    metafile: '/esbuild-metafiles/cli/metafile.json',
  },
};

export const Codemod = {
  args: {
    metafile: '/esbuild-metafiles/codemod/metafile.json',
  },
};

export const CreateStorybook = {
  args: {
    metafile: '/esbuild-metafiles/create-storybook/metafile.json',
  },
};

export const CoreBin = {
  args: {
    metafile: '/esbuild-metafiles/core/bin.json',
  },
};

export const CoreCLI = {
  args: {
    metafile: '/esbuild-metafiles/core/cli.json',
  },
};

export const CoreBabel = {
  args: {
    metafile: '/esbuild-metafiles/core/babel.json',
  },
};

