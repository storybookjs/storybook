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

```js filename="YourPage.stories.js|jsx" renderer="react" language="js"
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

```ts filename="YourPage.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

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

```ts filename="YourPage.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

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
const meta: Meta<typeof DocumentScreen> = {
  component: DocumentScreen,
  decorators: [
    (Story) => (
      <ApolloProvider client={mockedClient}>
        <Story />
      </ApolloProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SampleComponent>;

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

```js filename="YourPage.stories.js" renderer="svelte" language="js" tabTitle="story"
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
  import { ApolloClient, InMemoryCache } from '@apollo/client';

  import { setClient } from 'svelte-apollo';

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
  setClient(mockedClient);
</script>

<slot />
```

```ts filename="YourPage.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="story"
import type { Meta, StoryObj } from '@storybook/svelte';

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

```svelte filename="MockApolloWrapperClient.svelte" renderer="svelte" language="ts-4-9" tabTitle="apollo-wrapper-component"
<script lang="ts">
  import { ApolloClient, InMemoryCache } from '@apollo/client';

  import { setClient } from 'svelte-apollo';

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
  setClient(mockedClient);
</script>

<slot />
```

```ts filename="YourPage.stories.ts" renderer="svelte" language="ts" tabTitle="story"
import type { Meta, StoryObj } from '@storybook/svelte';

import { graphql, HttpResponse, delay } from 'msw';

import MockApolloWrapperClient from './MockApolloWrapperClient.svelte';
import DocumentScreen from './YourPage.svelte';

const meta: Meta<typeof DocumentScreen> = {
  component: DocumentScreen,
  decorators: [() => MockApolloWrapperClient],
};

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
  import { ApolloClient, InMemoryCache } from '@apollo/client';

  import { setClient } from 'svelte-apollo';

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
  setClient(mockedClient);
</script>

<slot />
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

```ts filename="YourPage.stories.ts" renderer="vue" language="ts-4-9" tabTitle="story"
import type { Meta, StoryObj } from '@storybook/vue3';

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

```html filename="ApolloWrapperClient.vue" renderer="vue" language="ts-4-9" tabTitle="apollo-wrapper-component"
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
import type { Meta, StoryObj } from '@storybook/vue3';

import { graphql, HttpResponse, delay } from 'msw';

import WrapperComponent from './ApolloWrapperClient.vue';
import DocumentScreen from './YourPage.vue';

const meta: Meta<typeof DocumentScreen> = {
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

export default meta;
type Story = StoryObj<typeof DocumentScreen>;

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
