```ts filename=".storybook/query-clients.ts" renderer="react" language="ts"
import { QueryClient } from '@tanstack/react-query';

const clients = new Map<string, QueryClient>();

// One QueryClient per story, shared by the router context, the
// QueryClientProvider, and story setup hooks.
export function queryClientForStory(storyId: string): QueryClient {
  let client = clients.get(storyId);
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Infinity,
        },
      },
    });
    clients.set(storyId, client);
  }
  return client;
}

export function removeStoryClient(storyId: string) {
  clients.get(storyId)?.clear();
  clients.delete(storyId);
}
```

```tsx filename=".storybook/preview.tsx" renderer="react" language="tsx" tabTitle="CSF 3"
import { QueryClientProvider } from '@tanstack/react-query';
import type { Preview } from '@storybook/tanstack-react';

import { queryClientForStory, removeStoryClient } from './query-clients';

const preview: Preview = {
  parameters: {
    tanstack: {
      router: {
        // The factory runs before the router's initial load, so route
        // loaders see the story's own client
        context: ({ storyContext }) => ({
          queryClient: queryClientForStory(storyContext.id),
        }),
      },
    },
  },
  decorators: [
    (Story, context) => (
      // The React tree reads the same per-story client
      <QueryClientProvider client={queryClientForStory(context.id)}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  afterEach: ({ id }) => {
    // Drop the client once the story's test finishes
    removeStoryClient(id);
  },
};

export default preview;
```

```tsx filename=".storybook/preview.tsx" renderer="react" language="tsx" tabTitle="CSF Next 🧪"
import { QueryClientProvider } from '@tanstack/react-query';
import { definePreview } from '@storybook/tanstack-react';

import { queryClientForStory, removeStoryClient } from './query-clients';

export default definePreview({
  parameters: {
    tanstack: {
      router: {
        // The factory runs before the router's initial load, so route
        // loaders see the story's own client
        context: ({ storyContext }) => ({
          queryClient: queryClientForStory(storyContext.id),
        }),
      },
    },
  },
  decorators: [
    (Story, context) => (
      // The React tree reads the same per-story client
      <QueryClientProvider client={queryClientForStory(context.id)}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  afterEach: ({ id }) => {
    // Drop the client once the story's test finishes
    removeStoryClient(id);
  },
});
```

```tsx filename="Navbar.stories.ts" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/tanstack-react';

import { queryClientForStory } from '../.storybook/query-clients';

import { Navbar } from './Navbar';

const meta = {
  component: Navbar,
} satisfies Meta<typeof Navbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedIn: Story = {
  beforeEach: ({ id }) => {
    // Seed the story's own client; other stories never see this data
    queryClientForStory(id).setQueryData(['currentUser'], {
      id: 'user-1',
      name: 'Ada Lovelace',
    });
  },
};
```
