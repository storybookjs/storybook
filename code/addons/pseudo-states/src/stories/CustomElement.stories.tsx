import React from 'react';

import { CustomElement } from './CustomElement';
import './grid.css';

export default {
  title: 'Example/CustomElement',
  component: CustomElement,
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  // @ts-expect-error We're dealing with a web component here
  render: () => <custom-element>Custom element</custom-element>,
};

export const All = () => (
  <div className="story-grid">
    <div>
      {/* @ts-expect-error We're dealing with a web component here */}
      <custom-element>Normal</custom-element>
    </div>
    <div className="pseudo-hover-all">
      {/* @ts-expect-error We're dealing with a web component here */}
      <custom-element>Hover</custom-element>
    </div>
    <div className="pseudo-focus-all">
      {/* @ts-expect-error We're dealing with a web component here */}
      <custom-element>Focus</custom-element>
    </div>
    <div className="pseudo-active-all">
      {/* @ts-expect-error We're dealing with a web component here */}
      <custom-element>Active</custom-element>
    </div>
    <div className="pseudo-hover-all pseudo-focus-all">
      {/* @ts-expect-error We're dealing with a web component here */}
      <custom-element>Hover Focus</custom-element>
    </div>
    <div className="pseudo-hover-all pseudo-active-all">
      {/* @ts-expect-error We're dealing with a web component here */}
      <custom-element>Hover Active</custom-element>
    </div>
    <div className="pseudo-focus-all pseudo-active-all">
      {/* @ts-expect-error We're dealing with a web component here */}
      <custom-element>Focus Active</custom-element>
    </div>
    <div className="pseudo-hover-all pseudo-focus-all pseudo-active-all">
      {/* @ts-expect-error We're dealing with a web component here */}
      <custom-element>Hover Focus Active</custom-element>
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
