```html renderer="svelte" language="js" tabTitle="with-mock-implementation"
{/* MockApolloWrapperClient.svelte */}

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

```html renderer="svelte" language="ts" tabTitle="with-mock-implementation"
{/* MockApolloWrapperClient.svelte */}

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

```html renderer="vue" language="js" tabTitle="with-mock-implementation-3"
{/* ApolloWrapperClient.vue */}

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

