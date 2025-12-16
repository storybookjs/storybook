import React from 'react';

import { Channel } from 'storybook/internal/channels';
import { STORY_INDEX_INVALIDATED } from 'storybook/internal/core-events';
import type { API_Provider } from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

import type { API, State } from 'storybook/manager-api';
import { findByRole, fn } from 'storybook/test';

import { defaultLayoutState, init as initLayout } from '../../../manager-api/modules/layout';
import { createTestingStore } from '../../../manager-api/store';
import { TagsFilter } from './TagsFilter';

/** Mock API wrapper that forces component updates when store state changes. */
class MockAPIWrapper extends React.Component<
  { children: React.ReactNode; args: any; initialState?: Partial<State> },
  { updateCount: number }
> {
  api: ReturnType<typeof initLayout>['api'];

  store: ReturnType<typeof createTestingStore>;

  channel: Channel;

  constructor(props: { children: React.ReactNode; args: any; initialState?: Partial<State> }) {
    super(props);
    this.state = { updateCount: 0 };

    // Merge custom initial state with default layout state
    const storeInitialState = props.initialState
      ? ({ ...defaultLayoutState, ...props.initialState } as State)
      : (defaultLayoutState as State);

    // Create store with onChange callback that forces update
    this.store = createTestingStore(storeInitialState, () => {
      this.forceUpdate();
    });

    this.channel = new Channel({});

    const provider: API_Provider<API> = {
      getConfig: () => ({}),
      handleAPI: () => {},
      channel: this.channel,
    };

    const experimentalSetFilterMock = fn().mockName('API::experimental_setFilter');
    const fullAPI = {
      experimental_setFilter: experimentalSetFilterMock,
    } as unknown as API;

    // When experimental_setFilter is called, emit STORY_INDEX_INVALIDATED
    experimentalSetFilterMock.mockImplementation(() => {
      this.channel.emit(STORY_INDEX_INVALIDATED);
    });

    const { api } = initLayout({
      fullAPI,
      store: this.store,
      provider,
      singleStory: false,
      location: { search: '' },
      navigate: () => {},
      path: '',
      docsOptions: {},
      state: {} as State,
    });

    this.api = api;
  }

  shouldComponentUpdate() {
    // Always update to reflect state changes
    return true;
  }

  render() {
    const { children, args } = this.props;
    return (
      <>
        {React.cloneElement(children as React.ReactElement, {
          args: {
            ...args,
            api: {
              ...this.api,
              getDocsUrl: () => 'https://storybook.js.org/docs/',
              getUrlState: () => ({
                queryParams: {},
                path: '',
                viewMode: 'story',
                url: 'http://localhost:6006/',
              }),
              applyQueryParams: fn().mockName('api::applyQueryParams'),
            } as any,
          },
        })}
      </>
    );
  }
}

const meta = {
  component: TagsFilter,
  title: 'Sidebar/TagsFilter',
  tags: ['haha', 'this-is-a-very-long-tag-that-will-be-truncated-after-a-while'],
  decorators: [
    (Story, context) => (
      <MockAPIWrapper args={context.args} initialState={context.parameters?.initialState}>
        <Story />
      </MockAPIWrapper>
    ),
  ],
  args: {
    api: {} as any, // Will be overridden by MockAPIWrapper
    indexJson: {
      v: 6,
      entries: {
        'c1-s1': { tags: ['A', 'B', 'C', 'dev', 'play-fn'], type: 'story' } as any,
        'c1-test': { tags: ['test-fn'], type: 'story', subtype: 'test' } as any,
        'c1-doc': { tags: [], type: 'docs' } as any,
      },
    },
  },
} satisfies Meta<typeof TagsFilter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const ClosedWithSelection: Story = {
  parameters: {
    initialState: {
      layout: {
        ...defaultLayoutState.layout,
        includedTagFilters: ['A', 'B'],
      },
    },
  },
};

// We can't properly test resetting to default, because resetting goes through
// global.TAGS_OPTIONS, which I didn't manage to mock. Setting defaultIncludedTagFilters
// still causes the API resetTagFilters function to reset based on the global rather than
// the initial state mocked in the story.

export const Clear = {
  ...Closed,
  play: async ({ canvasElement }) => {
    const button = await findByRole(canvasElement, 'button', {}, { timeout: 3000 });
    button.click();
  },
} satisfies Story;

export const NoUserTags = {
  ...Clear,
  args: {
    ...Clear.args,
    indexJson: {
      v: 6,
      entries: {
        'c1-s1': { tags: ['dev', 'play-fn'], type: 'story' } as any,
        'c1-test': { tags: ['test-fn'], type: 'story', subtype: 'test' } as any,
        'c1-doc': { tags: [], type: 'docs' } as any,
      },
    },
  },
} satisfies Story;

export const WithSelection = {
  ...ClosedWithSelection,
  play: Clear.play,
} satisfies Story;

export const WithSelectionInverted = {
  ...Clear,
  parameters: {
    initialState: {
      layout: {
        ...defaultLayoutState.layout,
        excludedTagFilters: ['A', 'B'],
      },
    },
  },
} satisfies Story;

export const WithSelectionMixed = {
  ...Clear,
  parameters: {
    initialState: {
      layout: {
        ...defaultLayoutState.layout,
        includedTagFilters: ['A'],
        excludedTagFilters: ['B'],
      },
    },
  },
} satisfies Story;

export const Empty: Story = {
  args: {
    indexJson: {
      v: 6,
      entries: {},
    },
  },
  play: Clear.play,
};

/** Production is equal to development now */
export const EmptyProduction: Story = {
  args: {
    ...Empty.args,
  },
  play: Clear.play,
};
