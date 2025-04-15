import React from 'react';

import { ShadowRoot } from './ShadowRootWithPart';
import './grid.css';

export default {
  title: 'Example/ShadowRootWithPart',
  component: ShadowRoot,
};

export const All = () => (
  <div className="story-grid">
    <div>
      <ShadowRoot label="Normal" />
    </div>
    <div className="pseudo-hover-all">
      <ShadowRoot label="Hover" />
    </div>
    <div className="pseudo-focus-all">
      <ShadowRoot label="Focus" />
    </div>
    <div className="pseudo-active-all">
      <ShadowRoot label="Active" />
    </div>
    <div className="pseudo-hover-all pseudo-focus-all">
      <ShadowRoot label="Hover Focus" />
    </div>
    <div className="pseudo-hover-all pseudo-active-all">
      <ShadowRoot label="Hover Active" />
    </div>
    <div className="pseudo-focus-all pseudo-active-all">
      <ShadowRoot label="Focus Active" />
    </div>
    <div className="pseudo-hover-all pseudo-focus-all pseudo-active-all">
      <ShadowRoot label="Hover Focus Active" />
    </div>
  </div>
);

export const Default = {};

export const Hover = {
  parameters: {
    pseudo: {
      hover: true,
    },
  },
};

export const Focus = {
  parameters: {
    pseudo: {
      focus: true,
    },
  },
};

export const Active = {
  parameters: {
    pseudo: {
      active: true,
    },
  },
};
