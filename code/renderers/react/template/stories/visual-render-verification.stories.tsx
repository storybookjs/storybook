import type { FC } from 'react';
import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';

const VisualRenderVerification: FC<{ border?: boolean }> = ({ border = false }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '200px',
      height: '120px',
      backgroundColor: '#3b82f6',
      color: 'white',
      fontSize: '16px',
      fontWeight: 'bold',
      border: border ? '3px solid #1e40af' : 'none',
      borderRadius: '8px',
    }}
  >
    {border ? 'Bordered' : 'Primary'}
  </div>
);

export default {
  component: VisualRenderVerification,
  parameters: { chromatic: { disableSnapshot: true } },
} as Meta<typeof VisualRenderVerification>;

export const Primary: StoryObj<typeof VisualRenderVerification> = {
  args: { border: false },
};

export const WithBorder: StoryObj<typeof VisualRenderVerification> = {
  args: { border: true },
};
