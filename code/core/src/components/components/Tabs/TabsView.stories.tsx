import { useState } from 'react';

import { Button, EmptyTabContent } from 'storybook/internal/components';

import { CrossIcon, ExpandIcon } from '@storybook/icons';

import { fn } from 'storybook/test';

import preview from '../../../../../.storybook/preview';
import { TabsView } from './TabsView';

const DEFAULT_TABS = [
  { id: 'tab1', title: 'Tab 1', children: () => <div>Content for Tab 1</div> },
  { id: 'tab2', title: 'Tab 2', children: () => <div>Content for Tab 2</div> },
  { id: 'tab3', title: 'Tab 3', children: () => <div>Content for Tab 3</div> },
];

const DEFAULT_TOOLS = (
  <div>
    <Button variant="ghost" padding="small" ariaLabel="Go full screen">
      <ExpandIcon />
    </Button>
    <Button variant="ghost" padding="small" ariaLabel="Close">
      <CrossIcon />
    </Button>
  </div>
);

const meta = preview.meta({
  title: 'Tabs/TabsView',
  component: TabsView,
  args: { backgroundColor: '#2e2e2e', tabs: DEFAULT_TABS, tools: DEFAULT_TOOLS },
  globals: { sb_theme: 'dark' },
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
        <TabsView
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
