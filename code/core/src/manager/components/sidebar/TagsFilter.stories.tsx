import React from 'react';

import { Channel } from 'storybook/internal/channels';
import type {
  API_Provider,
  DecoratorFunction,
  DocsIndexEntry,
  StoryIndexEntry,
} from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { deepMerge } from '@vitest/utils';
import type { API, State } from 'storybook/manager-api';
import { expect, fn, screen, waitFor } from 'storybook/test';

import type { ModuleArgs, ModuleFn } from '../../../manager-api/lib/types';
import { init as initLayout } from '../../../manager-api/modules/layout';
import { createTestingStore } from '../../../manager-api/store';
import { TagsFilter } from './TagsFilter';

/** Mock API wrapper that forces component updates when store state changes. */
export class MockAPIWrapper<SubAPI, SubState> extends React.Component<{
  children: React.ReactNode;
  args: Record<string, unknown>;
  initFn: ModuleFn<SubAPI, SubState>;
  initOptions?: Partial<ModuleArgs>;
  initialStoryState?: Partial<State>;
}> {
  api: ReturnType<typeof initLayout>['api'];
  store: ReturnType<typeof createTestingStore>;
  channel: Channel;
  mounted: boolean;

  constructor(props: {
    children: React.ReactNode;
    args: Record<string, unknown>;
    initFn: ModuleFn<SubAPI, SubState>;
    initOptions?: Partial<ModuleArgs>;
    initialStoryState?: Partial<State>;
  }) {
    super(props);

    // Set up store.
    this.mounted = false;
    this.store = createTestingStore({} as State, (newState) => {
      if (this.mounted) {
        this.setState(newState);
      }
    });

    // Mock channel and provider.
    this.channel = new Channel({});
    const provider: API_Provider<API> = {
      getConfig: () => ({}),
      handleAPI: () => {},
      channel: this.channel,
    };

    // Mock other submodules we depend on.
    const fullAPI = {
      experimental_setFilter: fn().mockName('API::experimental_setFilter'),
    } as unknown as API;

    const { api, init, state } = props.initFn({
      fullAPI,
      store: this.store,
      provider,
      location: { search: '' },
      navigate: () => {},
      path: '',
      docsOptions: {},
      state: {} as State,
      ...(props.initOptions ?? {}),
    });

    // Apply module and initial story states.
    if (props.initialStoryState) {
      this.store.setState(deepMerge<State>(state as State, props.initialStoryState));
    } else {
      this.store.setState(state as State);
    }

    // Call module's post init function if it exists.
    if (init && typeof init === 'function') {
      init();
    }

    this.api = api as API;
    this.state = this.store.getState();
  }

  componentDidMount() {
    this.mounted = true;
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
            },
          },
        })}
      </>
    );
  }
}

export const MockAPIDecorator: DecoratorFunction = (Story, { args, parameters }) => (
  <MockAPIWrapper
    args={args}
    initFn={initLayout}
    initialStoryState={parameters?.initialStoryState}
    initOptions={{ singleStory: false }}
  >
    <Story />
  </MockAPIWrapper>
);

const meta = {
  component: TagsFilter,
  title: 'Sidebar/TagsFilter',
  tags: ['haha', 'this-is-a-very-long-tag-that-will-be-truncated-after-a-while'],
  decorators: [MockAPIDecorator],
  args: {
    api: {} as API, // Will be overridden by MockAPIWrapper
    indexJson: {
      v: 6,
      entries: {
        'c1-s1': { tags: ['A', 'B', 'C', 'dev', 'play-fn'], type: 'story' } as StoryIndexEntry,
        'c1-test': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
        'c1-doc': { tags: [], type: 'docs' } as unknown as DocsIndexEntry,
      },
    },
  },
} satisfies Meta<typeof TagsFilter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const ClosedWithDefaultTags: Story = {
  beforeEach: () => {
    const originalTagsOptions = global.TAGS_OPTIONS;
    global.TAGS_OPTIONS = {
      A: { defaultFilterSelection: 'include' },
      B: { defaultFilterSelection: 'include' },
    };

    return () => {
      global.TAGS_OPTIONS = originalTagsOptions;
    };
  },
};

export const ClosedWithSelection: Story = {
  parameters: {
    initialStoryState: {
      layout: {
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
  ...ClosedWithSelection,
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', {}, { timeout: 3000 });
    button.click();

    const clearButton = await screen.findByRole('button', { name: 'Clear filters' });

    expect(clearButton).toBeInTheDocument();
    clearButton.click();
    await waitFor(() => expect(clearButton).not.toBeInTheDocument());
  },
} satisfies Story;

export const ResetToDefaults: Story = {
  ...ClosedWithDefaultTags,
  parameters: {
    initialStoryState: {
      layout: {
        excludedTagFilters: ['A', 'B', 'C'],
      },
    },
  },
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', {}, { timeout: 3000 });
    button.click();

    const resetButton = await screen.findByRole('button', { name: 'Reset filters' });

    expect(resetButton).toBeInTheDocument();
    expect(resetButton).not.toBeDisabled();
    resetButton.click();
    await waitFor(() => expect(resetButton).toBeDisabled());
  },
} satisfies Story;

export const NoUserTags = {
  ...Clear,
  args: {
    ...Clear.args,
    indexJson: {
      v: 6,
      entries: {
        'c1-s1': { tags: ['dev', 'play-fn'], type: 'story' } as StoryIndexEntry,
        'c1-test': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
        'c1-doc': { tags: [], type: 'docs' } as unknown as DocsIndexEntry,
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
    initialStoryState: {
      layout: {
        excludedTagFilters: ['A', 'B'],
      },
    },
  },
} satisfies Story;

export const WithSelectionMixed = {
  ...Clear,
  parameters: {
    initialStoryState: {
      layout: {
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
