import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import './negation.css';

const meta = {
  title: 'Negation',
  render: () => (
    <button className="negation-row" type="button">
      Hover or focus me
      <span className="negation-icon" aria-hidden="true">
        ★
      </span>
    </button>
  ),
  parameters: { pseudo: { hover: false, focusVisible: false } },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Native: Story = {};

export const Hover: Story = {
  parameters: { pseudo: { hover: true } },
};

export const TargetedHover: Story = {
  parameters: { pseudo: { hover: '.negation-row' } },
};

export const FocusVisible: Story = {
  parameters: { pseudo: { focusVisible: true } },
};

export const TargetedFocusVisible: Story = {
  parameters: { pseudo: { focusVisible: '.negation-row' } },
};

export const UnrelatedActive: Story = {
  parameters: { pseudo: { active: true } },
};

export const HoverElsewhere: Story = {
  render: () => (
    <>
      <meta.render />
      <span className="other-target">Other target</span>
    </>
  ),
  parameters: { pseudo: { hover: '.other-target' } },
};
