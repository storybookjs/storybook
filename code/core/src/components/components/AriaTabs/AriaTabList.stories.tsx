import preview from '../../../../../.storybook/preview';
import { AriaTabList } from './AriaTabList';
import type { TabProps } from './AriaTabs';
import { useAriaTabListState } from './AriaTabs';

const DEFAULT_TABS: TabProps[] = [
  { id: 'tab1', title: 'Tab 1', children: () => <div>Content for Tab 1</div> },
  { id: 'tab2', title: 'Tab 2', children: () => <div>Content for Tab 2</div> },
  { id: 'tab3', title: 'Tab 3', children: () => <div>Content for Tab 3</div> },
];

const meta = preview.meta({
  title: 'AriaTabList',
  component: AriaTabList,
  args: {
    tabs: DEFAULT_TABS,
    state: undefined,
  },
  decorators: [
    (Story, { args }) => {
      const state = useAriaTabListState({ tabs: args.tabs });
      return <Story args={{ ...args, state }} />;
    },
  ],
});

export const Basic = meta.story({});

export const WithAriaLabel = meta.story({
  args: {
    tabs: DEFAULT_TABS.map((tab) => ({
      ...tab,
      'aria-label': `Aria label for ${tab.title}`,
    })),
  },
});

export const WithDisabledTab = meta.story({
  args: {
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
});
