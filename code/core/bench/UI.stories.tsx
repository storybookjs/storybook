
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

export const Manager = {
  args: {
    metafile: '/esbuild-metafiles/core/manager.json',
  },
};

export const Components = {
  args: {
    metafile: '/esbuild-metafiles/core/components.json',
  },
};

