import { useState } from 'react';

import { Button, EmptyTabContent } from 'storybook/internal/components';

import { CrossIcon, ExpandIcon } from '@storybook/icons';

import { fn } from 'storybook/test';

import preview from '../../../../../.storybook/preview';
import { StatelessTab } from './StatelessTab';
import { StatelessTabList } from './StatelessTabList';
import { StatelessTabPanel } from './StatelessTabPanel';
import { StatelessTabsView, type StatelessTabsViewProps } from './StatelessTabsView';

const RenderDefault = (args: StatelessTabsViewProps) => (
  <StatelessTabsView {...args}>
    <StatelessTabList>
      <StatelessTab name="tab1">Tab 1</StatelessTab>
      <StatelessTab name="tab2">Tab 2</StatelessTab>
      <StatelessTab name="tab3">Tab 3</StatelessTab>
    </StatelessTabList>
    <StatelessTabPanel name="tab1">
      <div>Content for Tab 1</div>
    </StatelessTabPanel>
    <StatelessTabPanel name="tab2">
      <div>Content for Tab 2</div>
    </StatelessTabPanel>
    <StatelessTabPanel name="tab3">
      <div>Content for Tab 3</div>
    </StatelessTabPanel>
  </StatelessTabsView>
);

const RenderEmpty = (args: StatelessTabsViewProps) => (
  <StatelessTabsView {...args}>
    <StatelessTabList></StatelessTabList>
  </StatelessTabsView>
);

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

/**
 * Use this version of TabsView when you must ensure your tabs get rendered immediately and stay
 * stateful across the lifecycle of the TabsView, and/or when you can't afford to pass them as a
 * data array to feed into useTabsState. An example of that is the addons panel.
 */
const meta = preview.meta({
  title: 'Tabs/StatelessTabsView',
  component: StatelessTabsView,
  args: { backgroundColor: '#2e2e2e', children: '', tools: DEFAULT_TOOLS },
  globals: { sb_theme: 'dark' },
});

export const Basic = meta.story({
  args: {},
  render: RenderDefault,
});

export const Empty = meta.story({
  args: {},
  render: RenderEmpty,
});

export const EmptyCustom = meta.story({
  args: {
    emptyState: (
      <EmptyTabContent
        title="Custom empty state"
        description={<>This component does not currently have tabs.</>}
      />
    ),
  },
  render: RenderEmpty,
});

export const EmptyWithToolsShowFalse = meta.story({
  args: {
    showToolsWhenEmpty: false,
  },
  render: RenderEmpty,
});

export const EmptyWithToolsShowTrue = meta.story({
  args: {
    showToolsWhenEmpty: true,
  },
  render: RenderEmpty,
});

export const DefaultSelected = meta.story({
  args: {
    defaultSelected: 'tab2',
  },
  render: RenderDefault,
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
        <RenderDefault
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
