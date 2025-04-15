import React from 'react';

import { CustomElementNested } from './CustomElementNested';
import './grid.css';

export default {
  title: 'Example/CustomElementNested',
  component: CustomElementNested,
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  // @ts-expect-error We're dealing with a web component here
  render: () => <custom-element-nested>Custom element nested</custom-element-nested>,
};

export const All = () => (
  <div className="story-grid">
    <div>
      {/* @ts-expect-error We're dealing with a web component here */}
      <custom-element-nested>Normal</custom-element-nested>
    </div>
    <div className="pseudo-hover-all">
      {/* @ts-expect-error We're dealing with a web component here */}
      <custom-element-nested>Hover</custom-element-nested>
    </div>
    <div className="pseudo-focus-all">
      {/* @ts-expect-error We're dealing with a web component here */}
      <custom-element-nested>Focus</custom-element-nested>
    </div>
    <div className="pseudo-active-all">
      {/* @ts-expect-error We're dealing with a web component here */}
      <custom-element-nested>Active</custom-element-nested>
    </div>
    <div className="pseudo-hover-all pseudo-focus-all">
      {/* @ts-expect-error We're dealing with a web component here */}
      <custom-element-nested>Hover Focus</custom-element-nested>
    </div>
    <div className="pseudo-hover-all pseudo-active-all">
      {/* @ts-expect-error We're dealing with a web component here */}
      <custom-element-nested>Hover Active</custom-element-nested>
    </div>
    <div className="pseudo-focus-all pseudo-active-all">
      {/* @ts-expect-error We're dealing with a web component here */}
      <custom-element-nested>Focus Active</custom-element-nested>
    </div>
    <div className="pseudo-hover-all pseudo-focus-all pseudo-active-all">
      {/* @ts-expect-error We're dealing with a web component here */}
      <custom-element-nested>Hover Focus Active</custom-element-nested>
    </div>
  </div>
);

export const Default = {};

export const Hover = {
  parameters: {
    pseudo: { hover: true },
  },
};

export const Focus = {
  parameters: {
    pseudo: { focus: true },
  },
};

export const Active = {
  parameters: {
    pseudo: { active: true },
  },
};
