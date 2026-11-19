```tsx filename=".storybook/preview.tsx" renderer="react" language="tsx" tabTitle="CSF 4"
import { definePreview } from '@storybook/tanstack-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 👇 Create a new QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
});

export default definePreview({
  beforeEach: () => {
    // 👇 Clear the cache between stories so each story starts fresh
    queryClient.clear();
  },
  parameters: {
    tanstack: {
      router: {
        // 👇 Make queryClient available in stories' beforeEach via ctx.context.queryClient
        context: { queryClient },
      },
    },
  },
  decorators: [
    (Story) => (
      // 👇 Provide the QueryClient to all stories
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
});
```

```tsx filename=".storybook/preview.tsx" renderer="react" language="tsx" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Preview } from '@storybook/tanstack-react';

// 👇 Create a new QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
});

const preview: Preview = {
  beforeEach: () => {
    // 👇 Clear the cache between stories so each story starts fresh
    queryClient.clear();
  },
  parameters: {
    tanstack: {
      router: {
        // 👇 Make queryClient available in stories' beforeEach via ctx.context.queryClient
        context: { queryClient },
      },
    },
  },
  decorators: [
    (Story) => (
      // 👇 Provide the QueryClient to all stories
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
};

export default preview;
```
