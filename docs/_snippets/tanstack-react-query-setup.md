```tsx filename=".storybook/preview.tsx" renderer="react" language="tsx" tabTitle="CSF 3"
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

```tsx filename=".storybook/preview.tsx" renderer="react" language="tsx" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/tanstack-react';
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
