import type { CSSProperties } from 'react';
import React from 'react';

import { IFrame } from './Iframe';

export default {
  component: IFrame,
  title: 'Iframe',
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'sized',
      viewports: {
        sized: {
          name: 'Sized',
          styles: {
            width: '700px',
            height: '700px',
          },
        },
      },
    },
    chromatic: { viewports: [700] },
  },
  globals: { sb_theme: 'light' },
};

const style: CSSProperties = {
  maxWidth: '700px',
  height: '700px',
};

export const WorkingStory = {
  render: () => (
    <IFrame
      active
      id="iframe"
      title="Missing"
      src="/iframe.html?id=components-loader--infinite-state"
      allowFullScreen
      style={style}
      scale={1.0}
    />
  ),
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};

export const WorkingDocs = {
  render: () => (
    <IFrame
      active
      id="iframe"
      title="Missing"
      src="/iframe.html?id=brand-colorpalette--docs"
      allowFullScreen
      style={style}
      scale={1.0}
    />
  ),
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};

export const MissingStory = {
  render: () => (
    <IFrame
      active
      id="iframe"
      title="Missing"
      src="/iframe.html?id=missing"
      allowFullScreen
      style={style}
      scale={1.0}
    />
  ),
  parameters: {
    // Raise the threshold to ignore monospace font inconsistencies
    chromatic: { diffThreshold: 0.65 },
  },
};

export const PreparingStory = {
  render: () => (
    <IFrame
      active
      id="iframe"
      title="Preparing Story"
      src="/iframe.html?__SPECIAL_TEST_PARAMETER__=preparing-story"
      allowFullScreen
      style={style}
      scale={1.0}
    />
  ),
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};

export const PreparingDocs = {
  render: () => (
    <IFrame
      active
      id="iframe"
      title="Preparing Docs"
      src="/iframe.html?__SPECIAL_TEST_PARAMETER__=preparing-docs"
      allowFullScreen
      style={style}
      scale={1.0}
    />
  ),
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};
