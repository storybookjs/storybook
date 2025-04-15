import React, { type ComponentProps } from 'react';
import { createPortal } from 'react-dom';

import { Button } from './Button';
import './grid.css';

const PortalButton = (props: React.ComponentProps<typeof Button>) =>
  createPortal(<Button {...props} />, document.body);

export default {
  title: 'Example/Portal',
  component: Button,
  render: (args: ComponentProps<typeof PortalButton>) => (
    <PortalButton {...args}>Label</PortalButton>
  ),
};

export const Default = {
  parameters: { pseudo: { rootSelector: 'body' } },
};

export const Hover = {
  parameters: { pseudo: { hover: true, rootSelector: 'body' } },
};

export const Focus = {
  parameters: { pseudo: { focus: true, rootSelector: 'body' } },
};

export const Active = {
  parameters: { pseudo: { active: true, rootSelector: 'body' } },
};

export const FocusedHover = {
  parameters: { pseudo: { focus: true, hover: true, rootSelector: 'body' } },
};
