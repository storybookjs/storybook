```ts filename="YourPage.stories.ts" renderer="angular" language="ts" tabTitle="story"
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';

import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { graphql, HttpResponse, delay } from 'msw';

import { DocumentHeader } from './DocumentHeader.component';
import { DocumentList } from './DocumentList.component';
import { PageLayout } from './PageLayout.component';
import { DocumentScreen } from './YourPage.component';
import { MockGraphQLModule } from './mock-graphql.module';

const meta: Meta<DocumentScreen> = {
  component: DocumentScreen,
  decorators: [
    moduleMetadata({
      declarations: [DocumentList, DocumentHeader, PageLayout],
      imports: [CommonModule, HttpClientModule, MockGraphQLModule],
    }),
  ],
};

export default meta;

//👇The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

type Story = StoryObj<DocumentScreen>;

export const MockedSuccess: Story = {
  parameters: {
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', () => {
          return HttpResponse.json({
            data: {
              allInfo: {
                ...TestData,
              },
            },
          });
        }),
      ],
    },
  },
};

export const MockedError: Story = {
  parameters: {
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', async () => {
          await delay(800);
          return HttpResponse.json({
            errors: [
              {
                message: 'Access denied',
              },
            ],
          });
        }),
      ],
    },
  },
};
```

```ts filename="mock-graphql.module.ts" renderer="angular" language="ts" tabTitle="mock-apollo-module"
import { NgModule } from '@angular/core';
import { APOLLO_OPTIONS } from 'apollo-angular';

import { ApolloClientOptions, InMemoryCache } from '@apollo/client/core';
import { HttpLink } from 'apollo-angular/http';

// See here for docs https://apollo-angular.com/docs/get-started

const uri = 'https://your-graphql-endpoint';
export function createApollo(httpLink: HttpLink): ApolloClientOptions<any> {
  return {
    link: httpLink.create({ uri }),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
      },
      query: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
      },
    },
  };
}

@NgModule({
  providers: [
    {
      provide: APOLLO_OPTIONS,
      useFactory: createApollo,
      deps: [HttpLink],
    },
  ],
})
export class MockGraphQLModule {}
```

```jsx filename="YourPage.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import * as React from 'react';
import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client';
import { graphql, HttpResponse, delay } from 'msw';

import { DocumentScreen } from './YourPage';

const mockedClient = new ApolloClient({
  uri: 'https://your-graphql-endpoint',
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
  },
});

//👇The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

export default {
  component: DocumentScreen,
  decorators: [
    (Story) => (
      <ApolloProvider client={mockedClient}>
        <Story />
      </ApolloProvider>
    ),
  ],
};

export const MockedSuccess = {
  parameters: {
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', () => {
          return HttpResponse.json({
            data: {
              allInfo: {
                ...TestData,
              },
            },
          });
        }),
      ],
    },
  },
};

export const MockedError = {
  parameters: {
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', async () => {
          await delay(800);
          return HttpResponse.json({
            errors: [
              {
                message: 'Access denied',
              },
            ],
          });
        }),
      ],
    },
  },
};
```

```tsx filename="YourPage.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
import * as React from 'react';
import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client';
import { graphql, HttpResponse, delay } from 'msw';

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { DocumentScreen } from './YourPage';

const mockedClient = new ApolloClient({
  uri: 'https://your-graphql-endpoint',
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
  },
});

//👇The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};
const meta = {
  component: DocumentScreen,
  decorators: [
    (Story) => (
      <ApolloProvider client={mockedClient}>
        <Story />
      </ApolloProvider>
    ),
  ],
} satisfies Meta<typeof DocumentScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MockedSuccess: Story = {
  parameters: {
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', () => {
          return HttpResponse.json({
            data: {
              allInfo: {
                ...TestData,
              },
            },
          });
        }),
      ],
    },
  },
};

export const MockedError: Story = {
  parameters: {
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', async () => {
          await delay(800);
          return HttpResponse.json({
            errors: [
              {
                message: 'Access denied',
              },
            ],
          });
        }),
      ],
    },
  },
};
```

```svelte filename="YourPage.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import { graphql, HttpResponse, delay } from 'msw';

  import MockApolloWrapperClient from './MockApolloWrapperClient.svelte';
  import DocumentScreen from './YourPage.svelte';

  const { Story } = defineMeta({
    component: DocumentScreen,
    decorators: [() => MockApolloWrapperClient],
  });

  //👇The mocked data that will be used in the story
  const TestData = {
    user: {
      userID: 1,
      name: 'Someone',
    },
    document: {
      id: 1,
      userID: 1,
      title: 'Something',
      brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      status: 'approved',
    },
    subdocuments: [
      {
        id: 1,
        userID: 1,
        title: 'Something',
        content:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        status: 'approved',
      },
    ],
  };
</script>

<Story
  name="MockedSuccess"
  parameters={{
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', () => {
          return HttpResponse.json({
            data: {
              AllInfoQuery: {
                ...TestData,
              },
            },
          });
        }),
      ],
    },
  }}
/>

<Story
  name="MockedError"
  parameters={{
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', async () => {
          await delay(800);
          return HttpResponse.json({
            errors: [
              {
                message: 'Access denied',
              },
            ],
          });
        }),
      ],
    },
  }}
/>
```

```js filename="YourPage.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import { graphql, HttpResponse, delay } from 'msw';

import MockApolloWrapperClient from './MockApolloWrapperClient.svelte';
import DocumentScreen from './YourPage.svelte';

export default {
  component: DocumentScreen,
  decorators: [() => MockApolloWrapperClient],
};

//👇The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

export const MockedSuccess = {
  parameters: {
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', () => {
          return HttpResponse.json({
            data: {
              allInfo: {
                ...TestData,
              },
            },
          });
        }),
      ],
    },
  },
};

export const MockedError = {
  parameters: {
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', async () => {
          await delay(800);
          return HttpResponse.json({
            errors: [
              {
                message: 'Access denied',
              },
            ],
          });
        }),
      ],
    },
  },
};
```

```svelte filename="MockApolloWrapperClient.svelte" renderer="svelte" language="js" tabTitle="apollo-wrapper-component"
<script>
  import {
    Client,
    setContextClient,
    cacheExchange,
    fetchExchange,
  } from '@urql/svelte';

  const client = new Client({
    url: 'https://your-graphql-endpoint',
    exchanges: [cacheExchange, fetchExchange],
  });

  setContextClient(client);

  const { children } = $props();
</script>

<div>
  {@render children()}
</div>
```

```svelte filename="YourPage.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import { graphql, HttpResponse, delay } from 'msw';

  import MockApolloWrapperClient from './MockApolloWrapperClient.svelte';
  import DocumentScreen from './YourPage.svelte';

  const { Story } = defineMeta({
    component: DocumentScreen,
    decorators: [() => MockApolloWrapperClient],
  });

  //👇The mocked data that will be used in the story
  const TestData = {
    user: {
      userID: 1,
      name: 'Someone',
    },
    document: {
      id: 1,
      userID: 1,
      title: 'Something',
      brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      status: 'approved',
    },
    subdocuments: [
      {
        id: 1,
        userID: 1,
        title: 'Something',
        content:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        status: 'approved',
      },
    ],
  };
</script>

<Story
  name="MockedSuccess"
  parameters={{
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', () => {
          return HttpResponse.json({
            data: {
              AllInfoQuery: {
                ...TestData,
              },
            },
          });
        }),
      ],
    },
  }}
/>

<Story
  name="MockedError"
  parameters={{
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', async () => {
          await delay(800);
          return HttpResponse.json({
            errors: [
              {
                message: 'Access denied',
              },
            ],
          });
        }),
      ],
    },
  }}
/>
```

```ts filename="YourPage.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import { graphql, HttpResponse, delay } from 'msw';

import MockApolloWrapperClient from './MockApolloWrapperClient.svelte';
import DocumentScreen from './YourPage.svelte';

const meta = {
  component: DocumentScreen,
  decorators: [() => MockApolloWrapperClient],
} satisfies Meta<typeof DocumentScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

//👇The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

export const MockedSuccess: Story = {
  parameters: {
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', () => {
          return HttpResponse.json({
            data: {
              allInfo: {
                ...TestData,
              },
            },
          });
        }),
      ],
    },
  },
};

export const MockedError: Story = {
  parameters: {
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', async () => {
          await delay(800);
          return HttpResponse.json({
            errors: [
              {
                message: 'Access denied',
              },
            ],
          });
        }),
      ],
    },
  },
};
```

```svelte filename="MockApolloWrapperClient.svelte" renderer="svelte" language="ts" tabTitle="apollo-wrapper-component"
<script lang="ts">
  import {
    Client,
    setContextClient,
    cacheExchange,
    fetchExchange,
  } from '@urql/svelte';

  const client = new Client({
    url: 'https://your-graphql-endpoint',
    exchanges: [cacheExchange, fetchExchange],
  });

  setContextClient(client);

  interface Props {
    children: any;
  }
  const { children }: Props = $props();
</script>

<div>
  {@render children?.()}
</div>

```

```js filename="YourPage.stories.js" renderer="vue" language="js" tabTitle="story"
import { graphql, HttpResponse, delay } from 'msw';

import WrapperComponent from './ApolloWrapperClient.vue';
import DocumentScreen from './YourPage.vue';

export default {
  component: DocumentScreen,
  render: () => ({
    components: { DocumentScreen, WrapperComponent },
    template: '<WrapperComponent><DocumentScreen /></WrapperComponent>',
  }),
};

//👇The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

export const MockedSuccess = {
  parameters: {
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', () => {
          return HttpResponse.json({
            data: {
              allInfo: {
                ...TestData,
              },
            },
          });
        }),
      ],
    },
  },
};

export const MockedError = {
  parameters: {
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', async () => {
          await delay(800);
          return HttpResponse.json({
            errors: [
              {
                message: 'Access denied',
              },
            ],
          });
        }),
      ],
    },
  },
};
```

```html filename="ApolloWrapperClient.vue" renderer="vue" language="js" tabTitle="apollo-wrapper-component"
<template>
  <div><slot /></div>
</template>

<script>
  import { defineComponent, provide } from 'vue';
  import { DefaultApolloClient } from '@vue/apollo-composable';
  import { ApolloClient, createHttpLink, InMemoryCache } from '@apollo/client/core';

  // Apollo client wrapper component that can be used within your app and Storybook
  export default defineComponent({
    name: 'WrapperComponent',
    setup() {
      const httpLink = createHttpLink({
        // You should use an absolute URL here
        uri: 'https://your-graphql-endpoint',
      });
      const cache = new InMemoryCache();

      const mockedClient = new ApolloClient({
        link: httpLink,
        cache,
        defaultOptions: {
          watchQuery: {
            fetchPolicy: 'no-cache',
            errorPolicy: 'all',
          },
          query: {
            fetchPolicy: 'no-cache',
            errorPolicy: 'all',
          },
        },
      });
      provide(DefaultApolloClient, mockedClient);
    },
  });
</script>
```

```ts filename="YourPage.stories.ts" renderer="vue" language="ts" tabTitle="story"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { graphql, HttpResponse, delay } from 'msw';

import WrapperComponent from './ApolloWrapperClient.vue';
import DocumentScreen from './YourPage.vue';

const meta = {
  component: DocumentScreen,
  render: () => ({
    components: { DocumentScreen, WrapperComponent },
    template: '<WrapperComponent><DocumentScreen /></WrapperComponent>',
  }),
} satisfies Meta<typeof DocumentScreen>;

//👇The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const MockedSuccess: Story = {
  parameters: {
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', () => {
          return HttpResponse.json({
            data: {
              allInfo: {
                ...TestData,
              },
            },
          });
        }),
      ],
    },
  },
};

export const MockedError: Story = {
  parameters: {
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', async () => {
          await delay(800);
          return HttpResponse.json({
            errors: [
              {
                message: 'Access denied',
              },
            ],
          });
        }),
      ],
    },
  },
};
```

```html filename="ApolloWrapperClient.vue" renderer="vue" language="ts" tabTitle="apollo-wrapper-component"
<template>
  <div><slot /></div>
</template>

<script>
  import { defineComponent, provide } from 'vue';
  import { DefaultApolloClient } from '@vue/apollo-composable';
  import { ApolloClient, createHttpLink, InMemoryCache } from '@apollo/client/core';

  // Apollo client wrapper component that can be used within your app and Storybook
  export default defineComponent({
    name: 'WrapperComponent',
    setup() {
      const httpLink = createHttpLink({
        // You should use an absolute URL here
        uri: 'https://your-graphql-endpoint',
      });
      const cache = new InMemoryCache();

      const mockedClient = new ApolloClient({
        link: httpLink,
        cache,
        defaultOptions: {
          watchQuery: {
            fetchPolicy: 'no-cache',
            errorPolicy: 'all',
          },
          query: {
            fetchPolicy: 'no-cache',
            errorPolicy: 'all',
          },
        },
      });
      provide(DefaultApolloClient, mockedClient);
    },
  });
</script>
```

```tsx filename="YourPage.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import * as React from 'react';
import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client';
import { graphql, HttpResponse, delay } from 'msw';

import preview from '../.storybook/preview';

import { DocumentScreen } from './YourPage';

const mockedClient = new ApolloClient({
  uri: 'https://your-graphql-endpoint',
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
  },
});

//👇The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};
const meta = preview.meta({
  component: DocumentScreen,
  decorators: [
    (Story) => (
      <ApolloProvider client={mockedClient}>
        <Story />
      </ApolloProvider>
    ),
  ],
});

export const MockedSuccess = meta.story({
  parameters: {
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', () => {
          return HttpResponse.json({
            data: {
              allInfo: {
                ...TestData,
              },
            },
          });
        }),
      ],
    },
  },
});

export const MockedError = meta.story({
  parameters: {
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', async () => {
          await delay(800);
          return HttpResponse.json({
            errors: [
              {
                message: 'Access denied',
              },
            ],
          });
        }),
      ],
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```jsx filename="YourPage.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import * as React from 'react';
import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client';
import { graphql, HttpResponse, delay } from 'msw';

import preview from '../.storybook/preview';

import { DocumentScreen } from './YourPage';

const mockedClient = new ApolloClient({
  uri: 'https://your-graphql-endpoint',
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
  },
});

//👇The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

const meta = preview.meta({
  component: DocumentScreen,
  decorators: [
    (Story) => (
      <ApolloProvider client={mockedClient}>
        <Story />
      </ApolloProvider>
    ),
  ],
});

export const MockedSuccess = meta.story({
  parameters: {
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', () => {
          return HttpResponse.json({
            data: {
              allInfo: {
                ...TestData,
              },
            },
          });
        }),
      ],
    },
  },
});

export const MockedError = meta.story({
  parameters: {
    msw: {
      handlers: [
        graphql.query('AllInfoQuery', async () => {
          await delay(800);
          return HttpResponse.json({
            errors: [
              {
                message: 'Access denied',
              },
            ],
          });
        }),
      ],
    },
  },
});
```
