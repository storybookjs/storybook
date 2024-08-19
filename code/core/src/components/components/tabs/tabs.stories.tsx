import React from 'react';

import { BottomBarIcon, CloseIcon } from '@storybook/icons';
import type { Meta, StoryObj } from '@storybook/react';
import { expect } from '@storybook/test';
import { findByText, fireEvent, screen, userEvent, waitFor, within } from '@storybook/test';

import { action } from '@storybook/addon-actions';

import { IconButton } from '../IconButton/IconButton';
import { TabWrapper, Tabs, TabsState } from './tabs';
import type { ChildrenList } from './tabs.helpers';

const colours = Array.from(new Array(15), (val, index) => index).map((i) =>
  Math.floor((1 / 15) * i * 16777215)
    .toString(16)
    .padStart(6, '0')
);

interface FibonacciMap {
  [key: string]: number;
}

function Counter() {
  const [count, setCount] = React.useState(0);
  return <button onClick={() => setCount((prev) => prev + 1)}>{count}</button>;
}

function fibonacci(num: number, memo?: FibonacciMap): number {
  if (!memo) {
    memo = {};
  }
  if (memo[num]) {
    return memo[num];
  }
  if (num <= 1) {
    return 1;
  }

  memo[num] = fibonacci(num - 1, memo) + fibonacci(num - 2, memo);
  return memo[num];
}

type Panels = Record<string, Omit<ChildrenList[0], 'id'>>;

const panels: Panels = {
  test1: {
    title: 'Tab title #1',
    render: ({ active }) => (active ? <div id="test1">CONTENT 1</div> : null),
  },
  test2: {
    title: 'Tab title #2',
    render: ({ active }) => (
      <div
        id="test2"
        style={{
          background: 'hotpink',
          minHeight: '100%',
          display: active ? 'block' : 'none',
        }}
      >
        CONTENT 2
      </div>
    ),
  },
  test3: {
    title: 'Tab title #3',
    render: ({ active }) =>
      active ? (
        <div id="test3">
          {colours.map((colour, i) => (
            <div
              key={colour}
              style={{
                background: `#${colour}`,
                height: 30 + fibonacci(i + 5) / 10,
              }}
            />
          ))}
        </div>
      ) : null,
  },
  test4: {
    title: 'Tab title #4',
    render: ({ active }) => (active ? <div id="test4">CONTENT 4</div> : null),
  },
  test5: {
    title: 'Tab title #5',
    render: ({ active }) => (active ? <div id="test5">CONTENT 5</div> : null),
  },
  test6: {
    title: 'Tab title #6',
    render: ({ active }) => <TabWrapper active={active} render={() => <div>CONTENT 6</div>} />,
  },
};

const onSelect = action('onSelect');

const content = Object.entries(panels).map(([k, v]) => (
  <div key={k} id={k} title={v.title as any}>
    {/* @ts-expect-error (we know this is broken) */}
    {v.render}
  </div>
));

export default {
  args: {
    menuName: 'Addons',
  },
} satisfies Meta<typeof TabsState>;

type Story = StoryObj<typeof TabsState>;

export const StatefulStatic = {
  render: (args) => (
    <TabsState {...args} initial={args.initial ?? 'test2'}>
      <div id="test1" title="With a function">
        {
          (({ active, selected }: { active: boolean; selected: string }) =>
            active ? <div>{selected} is selected</div> : null) as any
        }
      </div>
      <div id="test2" title="With markup">
        <div>test2 is always active (but visually hidden)</div>
      </div>
    </TabsState>
  ),
} satisfies Story;

export const StatefulStaticWithSetButtonTextColors = {
  render: (args) => (
    <div>
      <TabsState {...args} initial={args.initial ?? 'test2'}>
        <div id="test1" title="With a function" color="#e00000">
          {
            (({ active, selected }: { active: boolean; selected: string }) =>
              active ? <div>{selected} is selected</div> : null) as any
          }
        </div>
        <div id="test2" title="With markup" color="green">
          <div>test2 is always active (but visually hidden)</div>
        </div>
      </TabsState>
    </div>
  ),
} satisfies Story;

export const StatefulStaticWithSetBackgroundColor = {
  render: (args) => (
    <div>
      <TabsState
        {...args}
        initial={args.initial || 'test2'}
        backgroundColor={args.backgroundColor ?? 'rgba(0,0,0,.05)'}
      >
        <div id="test1" title="With a function" color="#e00000">
          {
            (({ active, selected }: { active: boolean; selected: string }) =>
              active ? <div>{selected} is selected</div> : null) as any
          }
        </div>
        <div id="test2" title="With markup" color="green">
          <div>test2 is always active (but visually hidden)</div>
        </div>
      </TabsState>
    </div>
  ),
} satisfies Story;

const customViewports = {
  sized: {
    name: 'Sized',
    styles: {
      width: '380px',
      height: '500px',
    },
  },
};

export const StatefulDynamicWithOpenTooltip = {
  parameters: {
    viewport: {
      viewports: customViewports,
    },
    chromatic: { viewports: [380] },
  },
  globals: { sb_theme: 'light', viewport: 'sized' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(async () => {
      await expect(canvas.getAllByRole('tab')).toHaveLength(3);
      await expect(canvas.getByRole('tab', { name: /Addons/ })).toBeInTheDocument();
    });

    await waitFor(async () => {
      const addonsTab = await canvas.findByRole('tab', { name: /Addons/ });
      const tooltip = await screen.queryByTestId('tooltip');

      if (!tooltip) {
        await userEvent.click(addonsTab);
      }

      if (!tooltip) {
        throw new Error('Tooltip not found');
      }

      await expect(screen.queryByTestId('tooltip')).toBeInTheDocument();
    });
  },
  render: (args) => (
    <TabsState {...args} initial={args.initial ?? 'test1'}>
      {Object.entries(panels).map(([k, v]) => (
        <div key={k} id={k} title={v.title as any}>
          {/* @ts-expect-error (we know this is broken) */}
          {v.render}
        </div>
      ))}
    </TabsState>
  ),
} satisfies Story;

export const StatefulDynamicWithSelectedAddon = {
  ...StatefulDynamicWithOpenTooltip,
  play: async (context) => {
    await StatefulDynamicWithOpenTooltip.play(context);
    const canvas = within(context.canvasElement);

    await waitFor(async () => {
      const popperContainer = await screen.findByTestId('tooltip');
      const tab4 = await findByText(popperContainer, 'Tab title #4', {});
      fireEvent(tab4, new MouseEvent('click', { bubbles: true }));
      const content4 = await canvas.findByText('CONTENT 4');
      await expect(content4).toBeVisible();
    });

    // reopen the tooltip
    await StatefulDynamicWithOpenTooltip.play(context);
  },
  render: (args) => (
    <TabsState {...args} initial={args.initial ?? 'test1'}>
      {Object.entries(panels).map(([k, v]) => (
        <div key={k} id={k} title={v.title as any}>
          {/* @ts-expect-error (we know this is broken) */}
          {v.render}
        </div>
      ))}
    </TabsState>
  ),
} satisfies Story;

export const StatefulNoInitial = {
  render: (args) => <TabsState {...args}>{content}</TabsState>,
} satisfies Story;

export const StatelessBordered = {
  render: (args) => (
    <Tabs
      {...args}
      bordered={args.bordered ?? true}
      absolute={args.absolute ?? false}
      selected="test3"
      menuName={args.menuName ?? 'Addons'}
      actions={{
        onSelect,
      }}
    >
      {content}
    </Tabs>
  ),
} satisfies Story;

const AddonTools = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}
  >
    <IconButton title="Tool 1">
      <BottomBarIcon />
    </IconButton>
    <IconButton title="Tool 2">
      <CloseIcon />
    </IconButton>
  </div>
);

export const StatelessWithTools = {
  args: {
    tools: <AddonTools />,
  },
  render: (args) => (
    <Tabs
      bordered
      selected="test3"
      menuName="Addons"
      actions={{
        onSelect,
      }}
      {...args}
    >
      {content}
    </Tabs>
  ),
} satisfies StoryObj<typeof Tabs>;

export const StatelessAbsolute = {
  parameters: {
    layout: 'fullscreen',
  },
  render: (args) => (
    <Tabs
      absolute
      selected="test3"
      menuName="Addons"
      actions={{
        onSelect,
      }}
      {...args}
    >
      {content}
    </Tabs>
  ),
} satisfies StoryObj<typeof Tabs>;

export const StatelessAbsoluteBordered = {
  parameters: {
    layout: 'fullscreen',
  },
  render: (args) => (
    <Tabs
      absolute
      bordered
      menuName="Addons"
      selected="test3"
      actions={{
        onSelect,
      }}
      {...args}
    >
      {content}
    </Tabs>
  ),
} satisfies StoryObj<typeof Tabs>;

export const StatelessEmptyWithTools = {
  args: {
    ...StatelessWithTools.args,
    showToolsWhenEmpty: true,
  },
  parameters: {
    layout: 'fullscreen',
  },
  render: (args) => (
    <Tabs
      actions={{
        onSelect,
      }}
      bordered
      menuName="Addons"
      absolute
      {...args}
    />
  ),
} satisfies StoryObj<typeof Tabs>;

export const StatelessWithCustomEmpty = {
  args: {
    ...StatelessEmptyWithTools.args,
    emptyState: <div>I am custom!</div>,
  },
  parameters: {
    layout: 'fullscreen',
  },
  render: (args) => (
    <Tabs
      actions={{
        onSelect,
      }}
      bordered
      menuName="Addons"
      absolute
      {...args}
    />
  ),
} satisfies StoryObj<typeof Tabs>;

export const StatefulWithStatefulPanel = {
  render: (args) => {
    const [update, setUpdate] = React.useState(0);
    return (
      <div>
        <button onClick={() => setUpdate((prev) => prev + 1)}>Update</button>
        <TabsState {...args} initial={args.initial ?? 'test-1'}>
          <div id="test-1" title="Test 1">
            <Counter key={update} />
          </div>
          <div id="test-2" title="Test 2">
            <Counter key={update} />
          </div>
        </TabsState>
      </div>
    );
  },
} satisfies Story;
