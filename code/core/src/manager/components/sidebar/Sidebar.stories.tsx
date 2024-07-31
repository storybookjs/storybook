import React from 'react';

import type { IndexHash, State } from '@storybook/core/manager-api';
import { ManagerContext, types } from '@storybook/core/manager-api';
import type { StoryObj, Meta } from '@storybook/react';
import { within, userEvent, expect, fn } from '@storybook/test';
import type { Addon_SidebarTopType } from '@storybook/core/types';
import { Button, IconButton } from '@storybook/core/components';
import { FaceHappyIcon } from '@storybook/icons';
import { Sidebar, DEFAULT_REF_ID } from './Sidebar';
import { standardData as standardHeaderData } from './Heading.stories';
import { mockDataset } from './mockdata';
import type { RefType } from './types';
import { LayoutProvider } from '../layout/LayoutProvider';
import { IconSymbols } from './IconSymbols';

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const { menu } = standardHeaderData;
const index = mockDataset.withRoot as IndexHash;
const storyId = 'root-1-child-a2--grandchild-a1-1';

export const simpleData = { menu, index, storyId };
export const loadingData = { menu };

const meta = {
  component: Sidebar,
  title: 'Sidebar/Sidebar',
  excludeStories: /.*Data$/,
  parameters: { layout: 'fullscreen' },
  args: {
    previewInitialized: true,
    menu,
    extra: [] as Addon_SidebarTopType[],
    index: index,
    storyId,
    refId: DEFAULT_REF_ID,
    refs: {},
    status: {},
    showCreateStoryButton: true,
  },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider
        value={
          {
            state: {
              docsOptions: {
                defaultName: 'Docs',
                autodocs: 'tag',
                docsMode: false,
              },
            },
            api: {
              emit: fn().mockName('api::emit'),
              on: fn().mockName('api::on'),
              off: fn().mockName('api::off'),
              getShortcutKeys: fn(() => ({ search: ['control', 'shift', 's'] })).mockName(
                'api::getShortcutKeys'
              ),
              selectStory: fn().mockName('api::selectStory'),
            },
          } as any
        }
      >
        <LayoutProvider>
          <IconSymbols />
          {storyFn()}
        </LayoutProvider>
      </ManagerContext.Provider>
    ),
  ],
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

const refs: Record<string, RefType> = {
  optimized: {
    id: 'optimized',
    title: 'This is a ref',
    url: 'https://example.com',
    type: 'lazy',
    index,
    previewInitialized: true,
  },
};

// eslint-disable-next-line local-rules/no-uncategorized-errors
const indexError = new Error('Failed to load index');

const refsError = {
  optimized: {
    ...refs.optimized,
    // @ts-expect-error (non strict)
    index: undefined as IndexHash,
    indexError,
  },
};

const refsEmpty = {
  optimized: {
    ...refs.optimized,
    // type: 'auto-inject',
    index: {} as IndexHash,
  },
};

export const Simple: Story = {};

export const SimpleInProduction: Story = {
  args: {
    showCreateStoryButton: false,
  },
};

export const Loading: Story = {
  args: {
    previewInitialized: false,
    index: undefined,
  },
};

export const Empty: Story = {
  args: {
    index: {},
  },
};

export const IndexError: Story = {
  args: {
    indexError,
  },
};

export const WithRefs: Story = {
  args: {
    refs,
  },
};

export const LoadingWithRefs: Story = {
  args: {
    ...Loading.args,
    refs,
  },
};

export const LoadingWithRefError: Story = {
  args: {
    ...Loading.args,
    refs: refsError,
  },
};

export const WithRefEmpty: Story = {
  args: {
    ...Empty.args,
    refs: refsEmpty,
  },
};

export const StatusesCollapsed: Story = {
  args: {
    status: Object.entries(index).reduce<State['status']>((acc, [id, item]) => {
      if (item.type !== 'story') {
        return acc;
      }

      if (item.name.includes('B')) {
        return {
          ...acc,
          [id]: {
            addonA: { status: 'warn', title: 'Addon A', description: 'We just wanted you to know' },
            addonB: { status: 'error', title: 'Addon B', description: 'This is a big deal!' },
          },
        };
      }
      return acc;
    }, {}),
  },
};

export const StatusesOpen: Story = {
  ...StatusesCollapsed,
  args: {
    ...StatusesCollapsed.args,
    status: Object.entries(index).reduce<State['status']>((acc, [id, item]) => {
      if (item.type !== 'story') {
        return acc;
      }

      return {
        ...acc,
        [id]: {
          addonA: { status: 'warn', title: 'Addon A', description: 'We just wanted you to know' },
          addonB: { status: 'error', title: 'Addon B', description: 'This is a big deal!' },
        },
      };
    }, {}),
  },
};

export const Searching: Story = {
  ...StatusesOpen,
  parameters: { chromatic: { delay: 2200 } },
  play: async ({ canvasElement, step }) => {
    await step('wait 2000ms', () => wait(2000));
    const canvas = await within(canvasElement);
    const search = await canvas.findByPlaceholderText('Find components');
    userEvent.clear(search);
    userEvent.type(search, 'B2');
  },
};

export const Bottom: Story = {
  args: {
    bottom: [
      {
        id: '1',
        type: types.experimental_SIDEBAR_BOTTOM,
        render: () => (
          <Button>
            <FaceHappyIcon />
            Custom addon A
          </Button>
        ),
      },
      {
        id: '2',
        type: types.experimental_SIDEBAR_BOTTOM,
        render: () => (
          <Button>
            {' '}
            <FaceHappyIcon />
            Custom addon B
          </Button>
        ),
      },
      {
        id: '3',
        type: types.experimental_SIDEBAR_BOTTOM,
        render: () => (
          <IconButton>
            {' '}
            <FaceHappyIcon />
          </IconButton>
        ),
      },
    ],
  },
};

/**
 * Given the following sequence of events:
 * 1. Story is selected at the top of the sidebar
 * 2. The sidebar is scrolled to the bottom
 * 3. Some re-rendering happens because of a changed state/prop
 * The sidebar should remain scrolled to the bottom
 */
export const Scrolled: Story = {
  parameters: {
    // we need a very short viewport
    viewport: {
      defaultViewport: 'mobile1',
      defaultOrientation: 'landscape',
    },
  },
  args: {
    storyId: 'group-1--child-b1',
  },
  render: (args) => {
    const [, setState] = React.useState(0);
    return (
      <>
        <button
          style={{ position: 'absolute', zIndex: 10 }}
          onClick={() => setState(() => Math.random())}
        >
          Change state
        </button>
        <Sidebar {...args} />
      </>
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = await within(canvasElement);
    const scrollable = await canvasElement.querySelector('[data-radix-scroll-area-viewport]');
    await step('expand component', async () => {
      const componentNode = await canvas.queryAllByText('Child A2')[1];
      await userEvent.click(componentNode);
    });
    await wait(100);
    await step('scroll to bottom', async () => {
      // @ts-expect-error (non strict)
      scrollable.scrollTo(0, scrollable.scrollHeight);
    });
    await step('toggle parent state', async () => {
      const button = await canvas.findByRole('button', { name: 'Change state' });
      await userEvent.click(button);
    });
    await wait(100);

    // expect the scrollable to be scrolled to the bottom
    // @ts-expect-error (non strict)
    await expect(scrollable.scrollTop).toBe(scrollable.scrollHeight - scrollable.clientHeight);
  },
};
