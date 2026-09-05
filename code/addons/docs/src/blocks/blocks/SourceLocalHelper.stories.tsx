import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../examples/Button';

const buttonRowGap = 8;

const ButtonRow = ({ label }: { label: string }) => (
  <div style={{ display: 'flex', gap: buttonRowGap }}>
    <Button label={label} />
    <Button label={label} primary />
  </div>
);

/**
 * Fixture for the story-docs e2e (`code/e2e-internal/story-docs.spec.ts`): the render function names
 * a wrapper and a constant this file declares, which the snippet has to carry with it.
 */
const meta = {
  component: Button,
  tags: ['autodocs'],
  args: { label: 'Local helper' },
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: {
      codePanel: true,
    },
  },
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

export const WithLocalWrapper: Story = {
  render: (args) => <ButtonRow label={args.label} />,
};
