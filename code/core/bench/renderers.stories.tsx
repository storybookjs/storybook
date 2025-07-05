
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





export const RendererReact = {
  args: {
    metafile: '/esbuild-metafiles/react/metafile.json',
  },
};

export const RendererVue = {
  args: {
    metafile: '/esbuild-metafiles/vue3/metafile.json',
  },
};

export const RendererHtml = {
  args: {
    metafile: '/esbuild-metafiles/html/metafile.json',
  },
};

export const RendererSvelte = {
  args: {
    metafile: '/esbuild-metafiles/svelte/metafile.json',
  },
};






