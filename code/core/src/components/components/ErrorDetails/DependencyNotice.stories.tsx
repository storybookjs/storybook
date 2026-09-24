import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, within } from 'storybook/test';

import { Button } from '../Button/Button.tsx';
import { DependencyNotice } from './DependencyNotice.tsx';

const meta = {
  component: DependencyNotice,
  parameters: { layout: 'padded' },
  decorators: [
    (Story: React.ComponentType) => (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
        <Story />
      </div>
    ),
  ],
  tags: ['vitest'],
} satisfies Meta<typeof DependencyNotice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ComponentTestsFailed = {
  args: {
    cause: "This story's component tests failed.",
    workaround:
      'Automated accessibility tests will not run until this is resolved. You can still test manually.',
    action: (
      <Button variant="solid" ariaLabel={false}>
        Run accessibility scan
      </Button>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvas.getByText("This story's component tests failed.")).toBeInTheDocument();
    expect(
      canvas.getByText(/Automated accessibility tests will not run until this is resolved/)
    ).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Run accessibility scan' })).toBeInTheDocument();

    await expect(document.body).toHaveLiveRegion({
      text: "This story's component tests failed.",
      level: 'polite',
    });
  },
} satisfies Story;

export const CauseOnly = {
  args: {
    cause: 'The story failed to render, so this panel cannot run.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(
      canvas.getByText('The story failed to render, so this panel cannot run.')
    ).toBeInTheDocument();
    await expect(document.body).toHaveLiveRegion({
      text: 'The story failed to render, so this panel cannot run.',
      level: 'polite',
    });
  },
} satisfies Story;

// Dark companions: story-level `globals: { sb_theme: 'dark' }` lets Chromatic capture the dark
// theme (play-function stories without an explicit theme are forced light by the UI decorator).
export const ComponentTestsFailedDark = {
  ...ComponentTestsFailed,
  globals: { sb_theme: 'dark' },
} satisfies Story;

export const CauseOnlyDark = {
  ...CauseOnly,
  globals: { sb_theme: 'dark' },
} satisfies Story;
