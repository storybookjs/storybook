import React from 'react';

import {
  CHANGE_DETECTION_STATUS_TYPE_ID,
  type DecoratorFunction,
  type StatusValue,
  type StatusesByStoryIdAndTypeId,
} from 'storybook/internal/types';

import { global } from '@storybook/global';

import type { Meta, StoryObj } from '@storybook/react-vite';

import type { IndexHash } from 'storybook/manager-api';
import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { initialState } from '../../../shared/checklist-store/checklistData.state.ts';
import { defaultShortcuts } from '../../settings/defaultShortcuts.tsx';
import {
  internal_fullStatusStore,
  internal_universalChecklistStore,
} from '../../manager-stores.mock.ts';
import { LayoutProvider } from '../layout/LayoutProvider.tsx';
import { standardData as standardHeaderData } from './Heading.stories.tsx';
import { DEFAULT_REF_ID, Sidebar } from './Sidebar.tsx';
import { mockDataset } from './mockdata.ts';
import type { RefType } from './types.ts';

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const { menu } = standardHeaderData;
const index = mockDataset.withRoot as IndexHash;
const storyId = 'root-1-child-a2--grandchild-a1-1';

export const simpleData = { menu, index, storyId };
export const loadingData = { menu };

const managerContext: any = (
  args: Meta<typeof Sidebar>['args'],
  options: {
    includedStatusFilters?: StatusValue[];
    excludedStatusFilters?: StatusValue[];
  } = {}
) => ({
  state: {
    docsOptions: {
      defaultName: 'Docs',
      autodocs: 'tag',
      docsMode: false,
    },
    internal_index: args?.indexJson,
    includedStatusFilters: options.includedStatusFilters ?? [],
    excludedStatusFilters: options.excludedStatusFilters ?? [],
  },
  api: {
    emit: fn().mockName('api::emit'),
    on: fn().mockName('api::on'),
    off: fn().mockName('api::off'),
    once: fn().mockName('api::once'),
    getData: fn().mockName('api::getData'),
    getIndex: fn().mockName('api::getIndex'),
    getShortcutKeys: fn(() => defaultShortcuts).mockName('api::getShortcutKeys'),
    getChannel: fn().mockName('api::getChannel'),
    getElements: fn(() => ({})),
    navigate: fn().mockName('api::navigate'),
    selectStory: fn().mockName('api::selectStory'),
    experimental_setFilter: fn().mockName('api::experimental_setFilter'),
    experimental_setFilters: fn().mockName('api::experimental_setFilters'),
    getDocsUrl: () => 'https://storybook.js.org/docs/',
    getIsNavShown: () => true,
    getUrlState: () => ({
      queryParams: {},
      path: '',
      viewMode: 'story',
      url: 'http://localhost:6006/',
    }),
    applyQueryParams: fn().mockName('api::applyQueryParams'),
    setAllStatusFilters: fn().mockName('api::setAllStatusFilters'),
  },
});

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
    (storyFn, { args, globals, title, parameters }) => (
      <ManagerContext.Provider value={managerContext(args, parameters?.contextOptions ?? {})}>
        <LayoutProvider
          forceDesktop={
            globals.viewport?.value === 'desktop' ||
            globals.viewport?.value === undefined ||
            title.endsWith('scrolled')
          }
        >
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

const mobileLayoutDecorator: DecoratorFunction = (storyFn, { args, globals, title }) => (
  <ManagerContext.Provider value={managerContext(args)}>
    <LayoutProvider
      forceDesktop={
        globals.viewport?.value === 'desktop' ||
        globals.viewport?.value === undefined ||
        title.endsWith('scrolled')
      }
    >
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

const waitForChecklistWidget = async () => {
  await waitFor(
    () =>
      expect(document.getElementById('storybook-checklist-widget')?.checkVisibility()).toBe(true),
    { timeout: 5000 }
  );
  await wait(300); // wait for expand animation
};

export const Simple: Story = {
  play: waitForChecklistWidget,
};

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

export const SimpleNoChecklist: Story = {
  args: {
    showCreateStoryButton: false,
  },
  beforeEach: () => {
    const features = global.FEATURES;
    global.FEATURES = {
      ...features,
      sidebarOnboardingChecklist: false,
    };
    return () => {
      global.FEATURES = features;
    };
  },
};

export const Mobile: Story = {
  decorators: [mobileLayoutDecorator],
  globals: { sb_theme: 'light', viewport: { value: 'mobile1' } },
  play: waitForChecklistWidget,
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
  play: waitForChecklistWidget,
};

export const EmptyMobile: Story = {
  args: Empty.args,
  decorators: [mobileLayoutDecorator],
  globals: { sb_theme: 'light', viewport: { value: 'mobile1' } },
  play: waitForChecklistWidget,
};

export const EmptyWithFilters: Story = {
  args: Empty.args,
  decorators: [
    (storyFn, { args, globals, title }) => {
      const context = managerContext(args);
      return (
        <ManagerContext.Provider
          value={{
            ...context,
            state: {
              ...context.state,
              includedTagFilters: ['A'],
              excludedTagFilters: ['B'],
              includedStatusFilters: [],
              excludedStatusFilters: [],
            },
          }}
        >
          <LayoutProvider
            forceDesktop={
              globals.viewport?.value === 'desktop' ||
              globals.viewport?.value === undefined ||
              title.endsWith('scrolled')
            }
          >
            {storyFn()}
          </LayoutProvider>
        </ManagerContext.Provider>
      );
    },
  ],
  play: async ({ canvasElement }) => {
    await waitForChecklistWidget();
    const canvas = within(canvasElement);
    const clearFiltersButton = await canvas.findByRole('button', { name: 'Clear filters' });
    await expect(clearFiltersButton).toBeInTheDocument();
  },
};

export const EmptyIndex: Story = {
  args: {
    index: {},
    indexJson: {
      entries: {},
      v: 6,
    },
  },
  play: waitForChecklistWidget,
};

export const IndexError: Story = {
  args: {
    indexError,
  },
  play: waitForChecklistWidget,
};

export const WithRefs: Story = {
  args: {
    refs,
  },
  play: waitForChecklistWidget,
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
            width: '230px',
            height: '800px',
          },
        },
      },
    },
    chromatic: {
      modes: {
        narrow: {
          viewport: 230,
        },
      },
    },
  },
  globals: {
    viewport: {
      value: 'narrow',
    },
  },
  play: waitForChecklistWidget,
};

export const WithRefsMobile: Story = {
  args: WithRefs.args,
  decorators: [mobileLayoutDecorator],
  globals: { sb_theme: 'light', viewport: { value: 'mobile1' } },
  play: waitForChecklistWidget,
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
  play: waitForChecklistWidget,
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
  play: waitForChecklistWidget,
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
  play: waitForChecklistWidget,
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
    await waitForChecklistWidget();
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
    await waitForChecklistWidget();
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

export const StatusesMixed: Story = {
  args: {
    allStatuses: Object.entries(index).reduce((acc, [id, item]) => {
      if (item.type !== 'story') return acc;
      const values: StatusValue[] = [
        'status-value:new',
        'status-value:modified',
        'status-value:affected',
        'status-value:success',
        'status-value:warning',
      ];
      const value = values[Object.keys(acc).length % values.length];
      return {
        ...acc,
        [id]: {
          [CHANGE_DETECTION_STATUS_TYPE_ID]: {
            typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
            storyId: id,
            value,
            title: 'Change Detection',
            description: '',
          },
        },
      } satisfies StatusesByStoryIdAndTypeId;
    }, {} as StatusesByStoryIdAndTypeId),
  },
  play: waitForChecklistWidget,
};

export const StatusesChangeDetectionPriority: Story = {
  args: {
    allStatuses: Object.entries(index).reduce((acc, [id, item]) => {
      if (item.type !== 'story') return acc;
      // Cycles through all change-detection variants + warning/error to verify
      // priority ordering (most critical wins): error > warning > related > modified > new
      const priorityValues: StatusValue[] = [
        'status-value:new',
        'status-value:modified',
        'status-value:affected',
        'status-value:warning',
        'status-value:error',
      ];
      const value = priorityValues[Object.keys(acc).length % priorityValues.length];
      return {
        ...acc,
        [id]: {
          [CHANGE_DETECTION_STATUS_TYPE_ID]: {
            typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
            storyId: id,
            value,
            title: 'Change Detection',
            description: `Priority test: ${value}`,
          },
        },
      } satisfies StatusesByStoryIdAndTypeId;
    }, {} as StatusesByStoryIdAndTypeId),
  },
  play: waitForChecklistWidget,
};
