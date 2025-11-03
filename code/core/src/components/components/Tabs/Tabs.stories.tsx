import React from 'react';

import { Button } from 'storybook/internal/components';

import { BottomBarIcon, CloseIcon } from '@storybook/icons';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { action } from 'storybook/actions';
import { expect, spyOn } from 'storybook/test';
import { userEvent } from 'storybook/test';

import { TabWrapper, Tabs, TabsState } from './Tabs';
import type { ChildrenList } from './Tabs.helpers';

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

// Component that throws an error when rendered
function ErrorComponent() {
  throw new Error('This is a test error thrown by ErrorComponent');
  // The code below will never execute
  return <div>This component throws an error</div>;
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
  errorTab: {
    title: 'Error Tab',
    render: ({ active }) => (active ? <ErrorComponent /> : null),
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
    <Button padding="small" variant="ghost" ariaLabel="Tool 1">
      <BottomBarIcon />
    </Button>
    <Button padding="small" variant="ghost" ariaLabel="Tool 2">
      <CloseIcon />
    </Button>
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

// Story that demonstrates the error boundary functionality
export const WithErrorBoundary = {
  parameters: {
    test: {
      dangerouslyIgnoreUnhandledErrors: true,
    },
  },
  play: async ({ mount, args, canvas }) => {
    spyOn(console, 'error').mockImplementation(() => {});
    await mount(
      <TabsState {...args} initial="test1">
        <div id="test1" title="Normal Tab">
          {
            (({ active }: { active: boolean }) =>
              active ? <div>This tab renders normally</div> : null) as any
          }
        </div>
        <div id="errorTab" title="Error Tab">
          {(({ active }: { active: boolean }) => (active ? <ErrorComponent /> : null)) as any}
        </div>
      </TabsState>
    );
    // Check that the normal tab renders correctly
    await expect(canvas.getByText('This tab renders normally')).toBeInTheDocument();

    // Find and click the error tab to trigger the error
    const errorTab = canvas.getByRole('tab', { name: 'Error Tab' });
    await userEvent.click(errorTab);

    // Check that the error boundary message is displayed
    await expect(await canvas.findByText('This addon has errors')).toBeInTheDocument();
  },
} satisfies Story;
