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
    theme: 'light',
    chromatic: { viewports: [700] },
  },
};

const style: CSSProperties = {
  maxWidth: '700px',
  height: '700px',
};

export const WorkingStory = () => (
  <IFrame
    active
    id="iframe"
    title="Missing"
    src="/iframe.html?id=components-loader--infinite-state"
    allowFullScreen
    style={style}
    scale={1.0}
  />
);
WorkingStory.parameters = {
  chromatic: { disable: true },
};

export const WorkingDocs = () => (
  <IFrame
    active
    id="iframe"
    title="Missing"
    src="/iframe.html?id=components-colorpalette--docs"
    allowFullScreen
    style={style}
    scale={1.0}
  />
);
WorkingStory.parameters = {
  chromatic: { disable: true },
};

export const MissingStory = () => (
  <IFrame
    active
    id="iframe"
    title="Missing"
    src="/iframe.html?id=missing"
    allowFullScreen
    style={style}
    scale={1.0}
  />
);

export const PreparingStory = () => (
  <IFrame
    active
    id="iframe"
    title="Preparing Story"
    src="/iframe.html?__SPECIAL_TEST_PARAMETER__=preparing-story"
    allowFullScreen
    style={style}
    scale={1.0}
  />
);
PreparingStory.parameters = {
  chromatic: { disable: true },
};

export const PreparingDocs = () => (
  <IFrame
    active
    id="iframe"
    title="Preparing Docs"
    src="/iframe.html?__SPECIAL_TEST_PARAMETER__=preparing-docs"
    allowFullScreen
    style={style}
    scale={1.0}
  />
);
PreparingDocs.parameters = {
  chromatic: { disable: true },
};
