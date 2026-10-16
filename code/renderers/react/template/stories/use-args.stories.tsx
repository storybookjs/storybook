import React from 'react';

import { useArgs } from 'storybook/preview-api';

// Each story's button flags a distinct `clicked<Name>` arg on its own story via useArgs,
// and renders which markers are present. A scoping leak shows up as the page's primary
// story displaying another story's marker — asserted by the addon-docs e2e test (#28333).
const markerList = (args: Record<string, unknown>) =>
  Object.keys(args)
    .filter((key) => key.startsWith('clicked'))
    .sort()
    .join(',') || 'none';

export default {
  tags: ['autodocs'],
  render: () => {
    const [args, updateArgs] = useArgs<Record<string, unknown>>();
    const name = args.name as string;
    return (
      <button
        type="button"
        data-testid="value"
        onClick={() => updateArgs({ [`clicked${name}`]: true })}
      >
        {name}: {markerList(args)}
      </button>
    );
  },
  parameters: { chromatic: { disableSnapshot: true } },
};

export const StoryA = { args: { name: 'A' } };

export const StoryB = { args: { name: 'B' } };
