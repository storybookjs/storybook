import type { Meta, StoryObj } from '@storybook/react-vite';

import { findByRole, fn } from 'storybook/test';

import { TagsFilter } from './TagsFilter';

const meta = {
  component: TagsFilter,
  title: 'Sidebar/TagsFilter',
  tags: ['haha', 'this-is-a-very-long-tag-that-will-be-truncated-after-a-while'],
  args: {
    api: {
      experimental_setFilter: fn(),
      getDocsUrl: () => 'https://storybook.js.org/docs/',
      getUrlState: () => ({
        queryParams: {},
        path: '',
        viewMode: 'story',
        url: 'http://localhost:6006/',
      }),
      applyQueryParams: fn().mockName('api::applyQueryParams'),
    } as any,
    tagPresets: {},
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
  args: {
    ...Closed.args,
    tagPresets: {
      A: { defaultFilterSelection: 'include' },
      B: { defaultFilterSelection: 'include' },
    },
  },
};

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
  args: {
    ...Clear.args,
    tagPresets: {
      A: { defaultFilterSelection: 'exclude' },
      B: { defaultFilterSelection: 'exclude' },
    },
  },
} satisfies Story;

export const WithSelectionMixed = {
  ...Clear,
  args: {
    ...Clear.args,
    tagPresets: {
      A: { defaultFilterSelection: 'include' },
      B: { defaultFilterSelection: 'exclude' },
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
