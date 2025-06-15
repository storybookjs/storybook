
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



export const BuilderManager = {
  args: {
    metafile: '/esbuild-metafiles/core/builder-manager.json',
  },
};

export const BuilderVite = {
  args: {
    metafile: '/esbuild-metafiles/builder-vite/metafile.json',
  },
};
export const BuilderWebpack = {
  args: {
    metafile: '/esbuild-metafiles/builder-webpack5/metafile.json',
  },
};

export const CsfPlugin = {
  args: {
    metafile: '/esbuild-metafiles/csf-plugin/metafile.json',
  },
};

export const CoreWebpack = {
  args: {
    metafile: '/esbuild-metafiles/core-webpack/metafile.json',
  },
};
