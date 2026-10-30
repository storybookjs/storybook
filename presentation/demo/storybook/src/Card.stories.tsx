import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button.tsx';

function Card(): React.ReactElement {
  return (
    <div
      style={{
        width: 240,
        padding: 16,
        borderRadius: 8,
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.15)',
        font: '14px/20px system-ui, sans-serif',
      }}
    >
      <h3 style={{ margin: '0 0 8px' }}>Grid overlay</h3>
      <p style={{ margin: '0 0 16px' }}>Toggle the grid in the toolbar to check the spacing.</p>
      <Button label="Got it" />
    </div>
  );
}

const meta = { component: Card } satisfies Meta<typeof Card>;

export default meta;

export const Default: StoryObj<typeof meta> = {};
