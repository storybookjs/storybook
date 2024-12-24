import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';

const Component = () => (
  <div>
    <style jsx>{`
      .main p {
        color: #ff4785;
      }
    `}</style>
    <main className="main">
      <p>This is styled using Styled JSX</p>
    </main>
  </div>
);

export default {
  component: Component,
} as Meta<typeof Component>;

export const Default: StoryObj<typeof Component> = {};
