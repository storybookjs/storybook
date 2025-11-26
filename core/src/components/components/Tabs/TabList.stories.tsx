import { Bar } from 'storybook/internal/components';

import { expect } from 'storybook/test';

import preview from '../../../../../.storybook/preview';
import { TabList } from './TabList';
import { TabPanel } from './TabPanel';
import type { TabProps } from './TabsView';
import { useTabsState } from './TabsView';

const DEFAULT_TABS: TabProps[] = [
  {
    id: 'tab1',
    'aria-label': 'Tab one',
    title: 'Tab 1',
    children: () => <div>Content for Tab 1</div>,
  },
  { id: 'tab2', title: 'Tab 2', children: () => <div>Content for Tab 2</div> },
  { id: 'tab3', title: 'Tab 3', children: () => <div>Content for Tab 3</div> },
];

const MANY_TABS: TabProps[] = Array.from({ length: 20 }, (_, i) => ({
  id: `tab${i + 1}`,
  title: `Tab ${i + 1}`,
  children: () => <div>Content for Tab {i + 1}</div>,
}));

const LONG_TITLE_TABS: TabProps[] = [
  { id: 'tab1', title: 'Short', children: () => <div>Content for Tab 1</div> },
  {
    id: 'tab2',
    title: 'A very long tab title that will take up space',
    children: () => <div>Content for Tab 2</div>,
  },
  {
    id: 'tab3',
    title: 'Another extremely long tab title',
    children: () => <div>Content for Tab 3</div>,
  },
  { id: 'tab4', title: 'Medium title', children: () => <div>Content for Tab 4</div> },
  {
    id: 'tab5',
    title: 'Yet another very long tab title that extends',
    children: () => <div>Content for Tab 5</div>,
  },
];

const meta = preview.meta({
  title: 'Tabs/TabList',
  component: TabList,
  args: {
    tabs: DEFAULT_TABS,
    state: undefined,
  },
  parameters: {
    data: {
      tabs: DEFAULT_TABS,
    },
  },
  decorators: [
    (Story, { args, parameters }) => {
      const state = useTabsState({ tabs: parameters.data.tabs });
      return (
        <>
          <Story args={{ ...args, state }} />
          <TabPanel state={state} />
        </>
      );
    },
  ],
});

export const Basic = meta.story({});

export const WithAriaLabel = meta.story({
  parameters: {
    data: {
      tabs: DEFAULT_TABS.map((tab) => ({
        ...tab,
        'aria-label': `Aria label for ${tab.title}`,
      })),
    },
  },
});

export const WithDisabledTab = meta.story({
  parameters: {
    data: {
      tabs: [
        ...DEFAULT_TABS,
        {
          id: 'tab4',
          title: 'Disabled Tab',
          children: () => <div>Content for Disabled Tab</div>,
          isDisabled: true,
        },
      ],
    },
  },
});

export const WithManyTabs = meta.story({
  name: 'With Many Tabs (Scroll)',
  parameters: {
    data: {
      tabs: MANY_TABS,
    },
  },
});

export const WithLongTitles = meta.story({
  name: 'With Long Titles (Scroll)',
  parameters: {
    data: {
      tabs: LONG_TITLE_TABS,
    },
  },
});

export const WithFixedWidth = meta.story({
  name: 'Fixed Width Container (Scroll)',
  parameters: {
    data: {
      tabs: MANY_TABS.slice(0, 10),
    },
  },
  decorators: [
    (Story, { args }) => {
      return (
        <Bar
          border
          scrollable={false}
          innerStyle={{ width: 400, padding: 0 }}
          backgroundColor={'rgba(0,0,0,.05)'}
        >
          <Story args={{ ...args }} />
        </Bar>
      );
    },
  ],
});

export const PreservesAriaLabels = meta.story({
  name: 'Preserves ARIA Labels',
  play: ({ canvas }) => {
    const tabOne = canvas.getAllByRole('tab')[0];
    expect(tabOne).toHaveAttribute('aria-label', 'Tab one');
  },
});
