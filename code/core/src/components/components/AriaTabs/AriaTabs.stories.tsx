import { useState } from 'react';

import { EmptyTabContent, IconButton } from 'storybook/internal/components';
import { fn } from 'storybook/internal/test';

import { CrossIcon, ExpandIcon } from '@storybook/icons';

import type { Key } from 'react-aria';

import preview from '../../../../../.storybook/preview';
import { AriaTabs } from './AriaTabs';

const DEFAULT_TABS = [
  { id: 'tab1', title: 'Tab 1', children: () => <div>Content for Tab 1</div> },
  { id: 'tab2', title: 'Tab 2', children: () => <div>Content for Tab 2</div> },
  { id: 'tab3', title: 'Tab 3', children: () => <div>Content for Tab 3</div> },
];

const DEFAULT_TOOLS = (
  <div>
    <IconButton aria-label="Go full screen">
      <ExpandIcon />
    </IconButton>
    <IconButton aria-label="Close">
      <CrossIcon />
    </IconButton>
  </div>
);

const meta = preview.meta({
  title: 'AriaTabs',
  component: AriaTabs,
  args: { backgroundColor: '#2e2e2e', tabs: DEFAULT_TABS, tools: DEFAULT_TOOLS },
});

export const Basic = meta.story({});

export const Empty = meta.story({
  args: {
    tabs: [],
  },
});

export const EmptyCustom = meta.story({
  args: {
    tabs: [],
    emptyState: (
      <EmptyTabContent
        title="Custom empty state"
        description={<>This component does not currently have tabs.</>}
      />
    ),
  },
});

export const EmptyWithToolsShowFalse = meta.story({
  args: {
    tabs: [],
    showToolsWhenEmpty: false,
  },
});

export const EmptyWithToolsShowTrue = meta.story({
  args: {
    tabs: [],
    showToolsWhenEmpty: true,
  },
});

export const DefaultSelected = meta.story({
  args: {
    defaultSelected: 'tab2',
  },
});

export const ControlledState = meta.story({
  args: {
    selected: 'tab2',
    onSelectionChange: fn(),
  },
  render: (args) => {
    const [selected, setSelected] = useState(args.selected);
    return (
      <>
        <p>
          Current tab: <strong>{selected}</strong>
        </p>
        <AriaTabs
          {...args}
          selected={selected}
          onSelectionChange={(key) => {
            setSelected(key);
            args.onSelectionChange?.(key);
          }}
        />
      </>
    );
  },
});
