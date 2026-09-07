import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

const TallContent = ({ label }: { label: string }) => (
  <div>
    <h1>{label}</h1>
    {Array.from({ length: 200 }, (_, i) => (
      <p key={i} id={`row-${i}`}>
        Row {i} — {label}
      </p>
    ))}
  </div>
);

const meta = {
  title: 'ScrollLab',
  component: TallContent,
} satisfies Meta<typeof TallContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Fast: Story = {
  args: { label: '%TOKEN%' },
};

export const Slow: Story = {
  args: { label: '%TOKEN%' },
  loaders: [
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return {};
    },
  ],
};
