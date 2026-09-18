import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect } from 'storybook/test';

// The `storybook-ui` Vitest project pins `initialGlobals: { initialGlobalsWork: true }` in
// vitest.config.storybook.ts. This story renders that global and asserts it arrived, exercising the
// `initialGlobals` plugin option end to end (config -> provide/inject -> composed story globals).
const meta = {
  title: 'InitialGlobals',
  render: (_args, { globals }) => (
    <pre data-testid="initial-globals">{JSON.stringify(globals.initialGlobalsWork)}</pre>
  ),
  // The pinned global only exists in the `storybook-ui` Vitest project, so this story is meaningful
  // only there. Drop the `test` tag so the Chromatic/test-runner build (which has no such global)
  // does not run the play, and skip the snapshot since there is nothing visual to capture. It keeps
  // the `vitest` tag from the preview, so the `tests-stories` Vitest project still runs it.
  tags: ['!test'],
  parameters: { chromatic: { disableSnapshot: true } },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const FromVitestConfig: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId('initial-globals')).toHaveTextContent('true');
  },
};
