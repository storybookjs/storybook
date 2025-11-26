import type { FC } from 'react';
import { useState } from 'react';

import type { TabListState } from '@react-stately/tabs';
import { expect, userEvent, within } from 'storybook/test';

import preview from '../../../../../.storybook/preview';
import { TabList } from './TabList';
import { TabPanel } from './TabPanel';
import { useTabsState } from './TabsView';
import type { TabProps } from './TabsView';

const TabContent: FC<{ tabNumber: number }> = ({ tabNumber }) => {
  const [counter, setCounter] = useState(0);

  return (
    <div
      data-testid={tabNumber}
      style={{ backgroundColor: '#f0f0f0', color: '#111', padding: '20px' }}
    >
      <h3>Content for Tab {tabNumber}</h3>
      <button onClick={() => setCounter(counter + 1)}>Clicked {counter} times</button>
      <ul>
        {Array.from({ length: 20 }, (_, index) => (
          <li key={index}>Content line</li>
        ))}
      </ul>
    </div>
  );
};

const DEFAULT_TABS: TabProps[] = [
  { id: 'tab1', title: 'Tab 1', children: () => TabContent({ tabNumber: 1 }) },
  { id: 'tab2', title: 'Tab 2', children: () => TabContent({ tabNumber: 2 }) },
  { id: 'tab3', title: 'Tab 3', children: () => TabContent({ tabNumber: 3 }) },
];

const meta = preview.meta({
  title: 'Tabs/TabPanel',
  component: TabPanel,
  parameters: {
    data: {
      tabs: DEFAULT_TABS,
    },
  },
  args: {
    state: undefined,
    id: undefined,
  },
  decorators: [
    (Story) => {
      return (
        <div style={{ border: '1px solid grey', height: 400 }}>
          <Story />
        </div>
      );
    },
    (Story, { args, parameters }) => {
      const state = useTabsState({ tabs: parameters.data.tabs });
      return (
        <>
          <TabList state={state} />
          <Story args={{ ...args, id: (state as TabListState<object>).selectedItem?.key, state }} />
        </>
      );
    },
  ],
});

export const Basic = meta.story({});

export const WithScrollbar = meta.story({
  args: {
    hasScrollbar: true,
  },
});

export const WithoutScrollbar = meta.story({
  args: {
    hasScrollbar: false,
  },
});

export const RenderOnlySelected = meta.story({
  args: {
    renderAllChildren: false,
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const panel = canvas.getByRole('tabpanel');
    const tab1 = canvas.getByTestId(1);
    expect(panel).toBeInTheDocument();
    expect(tab1?.parentNode?.parentNode?.parentNode?.parentNode).toBe(panel);
    expect(canvas.getByText('Content for Tab 1')).toBeVisible();

    expect(canvas.queryByTestId(2)).not.toBeInTheDocument();
    expect(canvas.queryByTestId(3)).not.toBeInTheDocument();
  },
});

export const RenderAllChildren = meta.story({
  args: {
    renderAllChildren: true,
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const panel = canvas.getByRole('tabpanel');
    const tab1 = canvas.getByTestId(1);
    const tab2 = canvas.getByTestId(2);
    const tab3 = canvas.getByTestId(3);
    expect(panel).toBeInTheDocument();
    expect(tab1?.parentNode?.parentNode?.parentNode?.parentNode).toBe(panel);
    expect(canvas.getByText('Content for Tab 1')).toBeVisible();

    expect(tab2).toBeInTheDocument();
    expect(tab2?.parentNode?.parentNode?.parentNode?.parentNode).toHaveAttribute('hidden');
    expect(canvas.getByText('Content for Tab 2')).not.toBeVisible();

    expect(tab3).toBeInTheDocument();
    expect(tab3?.parentNode?.parentNode?.parentNode?.parentNode).toHaveAttribute('hidden');
    expect(canvas.getByText('Content for Tab 3')).not.toBeVisible();
  },
});

export const PreserveState = meta.story({
  args: {
    renderAllChildren: true,
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const panel = canvas.getByRole('tabpanel');

    await step('Setup', async () => {
      expect(panel).toBeInTheDocument();
      expect(canvas.getByText('Content for Tab 1')).toBeVisible();

      const button = canvas.getByRole('button');
      expect(button).toBeVisible();
      expect(button).toHaveTextContent('Clicked 0 times');
    });

    await step('Click stateful button', async () => {
      const button = canvas.getByRole('button');
      await userEvent.click(button);
      expect(button).toHaveTextContent('Clicked 1 time');
    });

    await step('Switch to Tab 2', async () => {
      const tab2 = canvas.getByRole('tab', { name: 'Tab 2' });
      await userEvent.click(tab2);

      expect(canvas.getByText('Content for Tab 2')).toBeVisible();
      expect(canvas.queryByText('Content for Tab 1')).not.toBeVisible();
    });

    await step('Switch back to Tab 1, notice preserved button state', async () => {
      const tab1 = canvas.getByRole('tab', { name: 'Tab 1' });
      await userEvent.click(tab1);

      expect(canvas.getByText('Content for Tab 1')).toBeVisible();
      expect(canvas.queryByText('Content for Tab 2')).not.toBeVisible();
      expect(canvas.getByRole('button')).toHaveTextContent('Clicked 1 time');
    });
  },
});
