
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

export const FrameworkReactVite = {
  args: {
    metafile: '/esbuild-metafiles/react-vite/metafile.json',
  },
};

export const FrameworkReactWebpack = {
  args: {
    metafile: '/esbuild-metafiles/react-webpack5/metafile.json',
  },
};

export const FrameworkVueVite = {
  args: {
    metafile: '/esbuild-metafiles/vue3-vite/metafile.json',
  },
};

export const FrameworkNextjs = {
  args: {
    metafile: '/esbuild-metafiles/nextjs/metafile.json',
  },
};

export const FrameworkNextjsVite = {
  args: {
    metafile: '/esbuild-metafiles/nextjs-vite/metafile.json',
  },
};

export const FrameworkSvelteVite = {
  args: {
    metafile: '/esbuild-metafiles/svelte-vite/metafile.json',
  },
};

export const FrameworkSvelteKit = {
  args: {
    metafile: '/esbuild-metafiles/sveltekit/metafile.json',
  },
};







