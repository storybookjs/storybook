
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


export const AddonAccessibility = {
  args: {
    metafile: '/esbuild-metafiles/addon-a11y/metafile.json',
  },
};
export const AddonDocs = {
  args: {
    metafile: '/esbuild-metafiles/addon-docs/metafile.json',
  },
};
export const AddonLinks = {
  args: {
    metafile: '/esbuild-metafiles/addon-links/metafile.json',
  },
};
export const AddonOnboarding = {
  args: {
    metafile: '/esbuild-metafiles/addon-onboarding/metafile.json',
  },
};
export const AddonThemes = {
  args: {
    metafile: '/esbuild-metafiles/addon-themes/metafile.json',
  },
};
export const AddonVitest = {
  args: {
    metafile: '/esbuild-metafiles/addon-vitest/metafile.json',
  },
};
export const AddonPseudoStates = {
  args: {
    metafile: '/esbuild-metafiles/storybook-addon-pseudo-states/metafile.json',
  },
};
export const AddonControls = {
  args: {
    metafile: '/esbuild-metafiles/core/controls.json',
  },
};
export const AddonActions = {
  args: {
    metafile: '/esbuild-metafiles/core/actions.json',
  },
};
export const AddonBackgrounds = {
  args: {
    metafile: '/esbuild-metafiles/core/backgrounds.json',
  },
};
export const AddonMeasure = {
  args: {
    metafile: '/esbuild-metafiles/core/measure.json',
  },
};
export const AddonHighlight = {
  args: {
    metafile: '/esbuild-metafiles/core/highlight.json',
  },
};

export const AddonOutline = {
  args: {
    metafile: '/esbuild-metafiles/core/outline.json',
  },
};
export const AddonViewport = {
  args: {
    metafile: '/esbuild-metafiles/core/viewport.json',
  },
};

