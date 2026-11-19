import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { useArgs } from 'storybook/preview-api';

import { TagList } from './TagList';

/**
 * Args a story changes while it runs, to a value no snippet can show: a Set, or another function.
 * Controls cannot set such values, so the buttons do. See `e2e-internal/story-docs.spec.ts`.
 */
const meta = {
  title: 'examples/Live snippet args',
  component: TagList,
  tags: ['autodocs'],
  parameters: { chromatic: { disableSnapshot: true } },
  decorators: [
    (Story, { args }) => {
      const [, updateArgs] = useArgs();
      const tags = Array.from(args.tags);
      return (
        <>
          <Story />
          <button onClick={() => updateArgs({ tags: new Set([...tags, 'plum']) })}>
            Add a tag
          </button>
          <button onClick={() => updateArgs({ onSelect: () => {} })}>Change onSelect</button>
        </>
      );
    },
  ],
} satisfies Meta<typeof TagList>;
export default meta;

export const Primary: StoryObj<typeof meta> = {
  args: { label: 'Fruits', tags: new Set(['apple', 'pear']) },
};
