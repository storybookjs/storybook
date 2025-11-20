import React from 'react';

import type { DecoratorFunction, StatusesByStoryIdAndTypeId } from 'storybook/internal/types';

import { global } from '@storybook/global';

import type { Meta, StoryObj } from '@storybook/react-vite';

import type { IndexHash } from 'storybook/manager-api';
import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, userEvent, within } from 'storybook/test';

import { initialState } from '../../../shared/checklist-store/checklistData.state';
import {
  internal_fullStatusStore,
  internal_universalChecklistStore,
} from '../../manager-stores.mock';
import { LayoutProvider } from '../layout/LayoutProvider';
import { standardData as standardHeaderData } from './Heading.stories';
import { IconSymbols } from './IconSymbols';
import { DEFAULT_REF_ID, Sidebar } from './Sidebar';
import { mockDataset } from './mockdata';
import type { RefType } from './types';

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const { menu } = standardHeaderData;
const index = mockDataset.withRoot as IndexHash;
const storyId = 'root-1-child-a2--grandchild-a1-1';

export const simpleData = { menu, index, storyId };
export const loadingData = { menu };

const managerContext: any = {
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
    getData: fn().mockName('api::getData'),
    getIndex: fn().mockName('api::getIndex'),
    getShortcutKeys: fn(() => ({ search: ['control', 'shift', 's'] })).mockName(
      'api::getShortcutKeys'
    ),
    getChannel: fn().mockName('api::getChannel'),
    getElements: fn(() => ({})),
    navigate: fn().mockName('api::navigate'),
    selectStory: fn().mockName('api::selectStory'),
    experimental_setFilter: fn().mockName('api::experimental_setFilter'),
    getDocsUrl: () => 'https://storybook.js.org/docs/',
    getUrlState: () => ({
      queryParams: {},
      path: '',
      viewMode: 'story',
      url: 'http://localhost:6006/',
    }),
    applyQueryParams: fn().mockName('api::applyQueryParams'),
  },
};

const meta = {
  component: Sidebar,
  title: 'Sidebar/Sidebar',
  excludeStories: /.*Data$/,
  parameters: { layout: 'fullscreen' },
  args: {
    previewInitialized: true,
    menu,
    index: index,
    indexJson: {
      entries: {
        // force the tags filter menu to show in production
        ['dummy--dummyId']: {
          id: 'dummy--dummyId',
          name: 'Dummy story',
          title: 'dummy',
          importPath: './dummy.stories.js',
          type: 'story',
          subtype: 'story',
          tags: ['A', 'B', 'C', 'dev'],
        },
      },
      v: 6,
    },
    storyId,
    refId: DEFAULT_REF_ID,
    refs: {},
    allStatuses: {},
    showCreateStoryButton: true,
    isDevelopment: true,
  },
  decorators: [
    (storyFn, { globals, title }) => (
      <ManagerContext.Provider value={managerContext}>
        <LayoutProvider
          forceDesktop={
            globals.viewport?.value === 'desktop' ||
            globals.viewport?.value === undefined ||
            title.endsWith('scrolled')
          }
        >
          <IconSymbols />
          {storyFn()}
        </LayoutProvider>
      </ManagerContext.Provider>
    ),
  ],
  globals: { sb_theme: 'side-by-side' },
  beforeEach: () => {
    internal_fullStatusStore.unset();
    internal_universalChecklistStore.setState({
      loaded: true,
      widget: {},
      items: {
        ...initialState.items,
        controls: { status: 'accepted' },
        renderComponent: { status: 'done' },
        viewports: { status: 'skipped' },
      },
    });
  },
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

const mobileLayoutDecorator: DecoratorFunction = (storyFn, { globals, title }) => (
  <ManagerContext.Provider value={managerContext}>
    <LayoutProvider
      forceDesktop={
        globals.viewport?.value === 'desktop' ||
        globals.viewport?.value === undefined ||
        title.endsWith('scrolled')
      }
    >
      <IconSymbols />
      {storyFn()}
    </LayoutProvider>
  </ManagerContext.Provider>
);

const refs: Record<string, RefType> = {
  optimized: {
    id: 'optimized',
    title: 'This is a ref',
    url: 'https://example.com',
    type: 'lazy',
    filteredIndex: index,
    previewInitialized: true,
    allStatuses: {},
  },
};

// eslint-disable-next-line local-rules/no-uncategorized-errors
const indexError = new Error('Failed to load index');

const refsError = {
  optimized: {
    ...refs.optimized,
    // @ts-expect-error (non strict)
    filteredIndex: undefined as IndexHash,
    indexError,
  },
};

const refsEmpty = {
  optimized: {
    ...refs.optimized,
    // type: 'auto-inject',
    filteredIndex: {} as IndexHash,
  },
};

export const Simple: Story = {};

export const SimpleInProduction: Story = {
  args: {
    showCreateStoryButton: false,
  },
  beforeEach: () => {
    const configType = global.CONFIG_TYPE;
    global.CONFIG_TYPE = 'PRODUCTION';
    return () => {
      global.CONFIG_TYPE = configType;
    };
  },
};

export const Mobile: Story = {
  decorators: [mobileLayoutDecorator],
  globals: { sb_theme: 'light', viewport: { value: 'mobile1' } },
};

export const Loading: Story = {
  args: {
    previewInitialized: false,
    index: undefined,
  },
};

export const LoadingMobile: Story = {
  args: Loading.args,
  decorators: [mobileLayoutDecorator],
  globals: { sb_theme: 'light', viewport: { value: 'mobile1' } },
};

export const Empty: Story = {
  args: {
    index: {},
  },
};

export const EmptyMobile: Story = {
  args: Empty.args,
  decorators: [mobileLayoutDecorator],
  globals: { sb_theme: 'light', viewport: { value: 'mobile1' } },
};

export const EmptyIndex: Story = {
  args: {
    index: {},
    indexJson: {
      entries: {},
      v: 6,
    },
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

export const WithRefsNarrow: Story = {
  args: {
    refs: {
      wide: {
        ...refs.optimized,
        title: 'This is a ref with a very long title',
      },
    },
  },
  parameters: {
    viewport: {
      options: {
        narrow: {
          name: 'narrow',
          styles: {
            width: '400px',
            height: '800px',
          },
        },
      },
    },
    chromatic: {
      modes: {
        narrow: {
          viewport: 400,
        },
      },
    },
  },
  globals: {
    viewport: {
      value: 'narrow',
    },
  },
};

export const WithRefsMobile: Story = {
  args: WithRefs.args,
  decorators: [mobileLayoutDecorator],
  globals: { sb_theme: 'light', viewport: { value: 'mobile1' } },
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

export const LoadingWithRefErrorMobile: Story = {
  args: LoadingWithRefError.args,
  decorators: [mobileLayoutDecorator],
  globals: { sb_theme: 'light', viewport: { value: 'mobile1' } },
};

export const WithRefEmpty: Story = {
  args: {
    ...Empty.args,
    refs: refsEmpty,
  },
};

export const StatusesCollapsed: Story = {
  args: {
    allStatuses: Object.entries(index).reduce((acc, [id, item]) => {
      if (item.type !== 'story') {
        return acc;
      }

      if (item.name.includes('B')) {
        return {
          ...acc,
          [id]: {
            addonA: {
              typeId: 'addonA',
              storyId: id,
              value: 'status-value:warning',
              title: 'Addon A',
              description: 'We just wanted you to know',
            },
            addonB: {
              typeId: 'addonB',
              storyId: id,
              value: 'status-value:error',
              title: 'Addon B',
              description: 'This is a big deal!',
            },
          },
        } satisfies StatusesByStoryIdAndTypeId;
      }
      return acc;
    }, {} as StatusesByStoryIdAndTypeId),
  },
};

export const StatusesOpen: Story = {
  ...StatusesCollapsed,
  args: {
    allStatuses: Object.entries(index).reduce((acc, [id, item]) => {
      if (item.type !== 'story') {
        return acc;
      }

      return {
        ...acc,
        [id]: {
          addonA: {
            typeId: 'addonA',
            storyId: id,
            value: 'status-value:warning',
            title: 'Addon A',
            description: 'We just wanted you to know',
          },
          addonB: {
            typeId: 'addonB',
            storyId: id,
            value: 'status-value:error',
            title: 'Addon B',
            description: 'This is a big deal!',
          },
        },
      } satisfies StatusesByStoryIdAndTypeId;
    }, {} as StatusesByStoryIdAndTypeId),
  },
};

export const Searching: Story = {
  ...StatusesOpen,
  parameters: { chromatic: { delay: 2200 } },
  globals: { sb_theme: 'light' },
  decorators: [
    (StoryFn) => (
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        <StoryFn />
      </div>
    ),
  ],
  play: async ({ canvasElement, step }) => {
    await step('wait 2000ms', () => wait(2000));
    const canvas = await within(canvasElement);
    const search = await canvas.findByPlaceholderText('Find components');
    userEvent.clear(search);
    userEvent.type(search, 'B2');
  },
};

export const Bottom: Story = {
  beforeEach: () => {
    internal_fullStatusStore.set([
      {
        storyId,
        typeId: 'vitest',
        value: 'status-value:warning',
        title: 'Vitest',
        description: 'Vitest',
      },
      {
        storyId,
        typeId: 'vta',
        value: 'status-value:error',
        title: 'VTA',
        description: 'VTA',
      },
      {
        storyId: 'root-1-child-a2--grandchild-a1-2',
        typeId: 'vitest',
        value: 'status-value:warning',
        title: 'Vitest',
        description: 'Vitest',
      },
    ]);
  },
};

/**
 * Given the following sequence of events:
 *
 * 1. Story is selected at the top of the sidebar
 * 2. The sidebar is scrolled to the bottom
 * 3. Some re-rendering happens because of a changed state/prop The sidebar should remain scrolled to
 *    the bottom
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
  globals: { sb_theme: 'light' },
  decorators: [
    (StoryFn) => (
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        <StoryFn />
      </div>
    ),
  ],

  render: (args) => {
    const [, setState] = React.useState(0);
    return (
      <>
        <button
          style={{ position: 'absolute', zIndex: 10, bottom: 0, right: 0 }}
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
