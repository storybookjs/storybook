import React from 'react';

import { Input } from './Input';
import './grid.css';

export default {
  title: 'Example/Input',
  component: Input,
};

export const All = () => (
  <div className="story-grid pseudo">
    <div>
      <Input defaultValue="Normal" />
    </div>
    <div className="pseudo-hover-all">
      <Input defaultValue="Hover" />
    </div>
    <div className="pseudo-focus-all">
      <Input defaultValue="Focus" />
    </div>
    <div className="pseudo-hover-all pseudo-focus-all">
      <Input defaultValue="Hover Focus" />
    </div>
  </div>
);

export const Default = {};

export const Hover = {
  parameters: { pseudo: { hover: true } },
};

export const Focus = {
  parameters: { pseudo: { focus: true } },
};
