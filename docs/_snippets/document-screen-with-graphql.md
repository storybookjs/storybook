```ts filename="YourPage.component.ts" renderer="angular" language="ts"
import { Component, OnInit } from '@angular/core';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';

@Component({
  selector: 'document-screen',
  template: `
    <div *ngIf="loading">Loading...</div>
    <div *ngIf="error">There was an error fetching the data!</div>
    <div *ngIf="!loading && subdocuments.length > 0">
      <page-layout [user]="user">
        <document-header [document]="document"></document-header>
        <document-list [documents]="subdocuments"></document-list>
      </page-layout>
    </div>
  `,
})
export class SampleGraphqlComponent implements OnInit {
  user: any = { id: 0, name: 'Some User' };

  document: any = { id: 0, title: 'Some Title' };

  subdocuments: any = [];

  error = '';
  loading = true;

  constructor(private apollo: Apollo) {}
  ngOnInit() {
    this.apollo
      .watchQuery({
        query: gql`
          query AllInfoQuery {
            user {
              userID
              name
            }
            document {
              id
              userID
              title
              brief
              status
            }
            subdocuments {
              id
              userID
              title
              content
              status
            }
          }
        `,
      })
      .valueChanges.subscribe((result: any) => {
        this.user = result?.data?.user;
        this.document = result?.data?.document;
        this.subdocuments = result?.data?.subdocuments;
        this.loading = result.loading;

        // Errors is an array and we're getting the first item only
        this.error = result.errors[0].message;
      });
  }
}
```

```js filename="YourPage.jsx" renderer="react" language="js"
import { useQuery, gql } from '@apollo/client';

import { PageLayout } from './PageLayout';
import { DocumentHeader } from './DocumentHeader';
import { DocumentList } from './DocumentList';

const AllInfoQuery = gql`
  query AllInfo {
    user {
      userID
      name
    }
    document {
      id
      userID
      title
      brief
      status
    }
    subdocuments {
      id
      userID
      title
      content
      status
    }
  }
`;

function useFetchInfo() {
  const { loading, error, data } = useQuery(AllInfoQuery);

  return { loading, error, data };
}

export function DocumentScreen() {
  const { loading, error, data } = useFetchInfo();

  if (loading) {
    return <p>Loading...</p>;
  }

  if (error) {
    return <p>There was an error fetching the data!</p>;
  }

  return (
    <PageLayout user={data.user}>
      <DocumentHeader document={data.document} />
      <DocumentList documents={data.subdocuments} />
    </PageLayout>
  );
}
```

```ts filename="YourPage.tsx" renderer="react" language="ts"
import { useQuery, gql } from '@apollo/client';

import { PageLayout } from './PageLayout';
import { DocumentHeader } from './DocumentHeader';
import { DocumentList } from './DocumentList';

const AllInfoQuery = gql`
  query AllInfo {
    user {
      userID
      name
    }
    document {
      id
      userID
      title
      brief
      status
    }
    subdocuments {
      id
      userID
      title
      content
      status
    }
  }
`;

interface Data {
  allInfo: {
    user: {
      userID: number;
      name: string;
      opening_crawl: boolean;
    };
    document: {
      id: number;
      userID: number;
      title: string;
      brief: string;
      status: string;
    };
    subdocuments: {
      id: number;
      userID: number;
      title: string;
      content: string;
      status: string;
    };
  };
}

function useFetchInfo() {
  const { loading, error, data } = useQuery<Data>(AllInfoQuery);

  return { loading, error, data };
}

export function DocumentScreen() {
  const { loading, error, data } = useFetchInfo();

  if (loading) {
    return <p>Loading...</p>;
  }

  if (error) {
    return <p>There was an error fetching the data!</p>;
  }

  return (
    <PageLayout user={data.user}>
      <DocumentHeader document={data.document} />
      <DocumentList documents={data.subdocuments} />
    </PageLayout>
  );
}
```

```js filename="YourPage.jsx" renderer="solid" language="js"
import { Match, Switch } from 'solid-js';
import { createGraphQLClient, gql } from '@solid-primitives/graphql';

import { PageLayout } from './PageLayout';
import { DocumentHeader } from './DocumentHeader';
import { DocumentList } from './DocumentList';

const newQuery = createGraphQLClient('https://foobar.com/v1/api');
const AllInfoQuery = gql`
  query AllInfo {
    user {
      userID
      name
    }
    document {
      id
      userID
      title
      brief
      status
    }
    subdocuments {
      id
      userID
      title
      content
      status
    }
  }
`;

function useFetchInfo() {
  const [data] = newQuery(AllInfoQuery, { path: 'home' });
  return data;
}

export function DocumentScreen() {
  const data = useFetchInfo();

  return (
    <Switch>
      <Match when={data.loading}>
        <p>Loading...</p>
      </Match>
      <Match when={data.error}>
        <p>There was an error fetching the data!</p>
      </Match>
      <Match when={data()} keyed>
        {(data) => (
          <PageLayout user={data.user}>
            <DocumentHeader document={data.document} />
            <DocumentList documents={data.subdocuments} />
          </PageLayout>
        )}
      </Match>
    </Switch>
  );
}
```

```ts filename="YourPage.tsx" renderer="solid" language="ts"
import { createGraphQLClient, gql } from '@solid-primitives/graphql';

import { PageLayout } from './PageLayout';
import { DocumentHeader } from './DocumentHeader';
import { DocumentList } from './DocumentList';

const newQuery = createGraphQLClient('https://foobar.com/v1/api');
const AllInfoQuery = gql`
  query AllInfo {
    user {
      userID
      name
    }
    document {
      id
      userID
      title
      brief
      status
    }
    subdocuments {
      id
      userID
      title
      content
      status
    }
  }
`;

interface Data {
  allInfo: {
    user: {
      userID: number;
      name: string;
      opening_crawl: boolean;
    };
    document: {
      id: number;
      userID: number;
      title: string;
      brief: string;
      status: string;
    };
    subdocuments: {
      id: number;
      userID: number;
      title: string;
      content: string;
      status: string;
    };
  };
}

function useFetchInfo() {
  const [data] = newQuery<Data>(AllInfoQuery, { path: 'home' });
  return data;
}

export function DocumentScreen() {
  const data = useFetchInfo();

  return (
    <Switch>
      <Match when={data.loading}>
        <p>Loading...</p>
      </Match>
      <Match when={data.error}>
        <p>There was an error fetching the data!</p>
      </Match>
      <Match when={data()} keyed>
        {(data) => (
          <PageLayout user={data.user}>
            <DocumentHeader document={data.document} />
            <DocumentList documents={data.subdocuments} />
          </PageLayout>
        )}
      </Match>
    </Switch>
  );
}
```

```html filename="YourPage.vue" renderer="vue" language="js"
<template>
  <div v-if="loading">Loading...</div>

  <div v-else-if="error">There was an error fetching the data!</div>

  <div v-if="!loading && data && result.subdocuments.length">
    <PageLayout :user="data.user">
      <DocumentHeader :document="result.document" />
      <DocumentList :documents="result.subdocuments" />
    </PageLayout>
  </div>
</template>

<script>
  import PageLayout from './PageLayout';
  import DocumentHeader from './DocumentHeader';
  import DocumentList from './DocumentList';

  import gql from 'graphql-tag';
  import { useQuery } from '@vue/apollo-composable';

  export default {
    name: 'DocumentScreen',
    setup() {
      const { result, loading, error } = useQuery(gql`
        query AllInfoQuery {
          user {
            userID
            name
          }
          document {
            id
            userID
            title
            brief
            status
          }
          subdocuments {
            id
            userID
            title
            content
            status
          }
        }
      `);
      return {
        result,
        loading,
        error,
      };
    },
  };
</script>
```

```html filename="YourPage.vue" renderer="vue" language="ts"
<template>
  <div v-if="loading">Loading...</div>

  <div v-else-if="error">There was an error fetching the data!</div>

  <div v-if="!loading && data && result.subdocuments.length">
    <PageLayout :user="data.user">
      <DocumentHeader :document="result.document" />
      <DocumentList :documents="result.subdocuments" />
    </PageLayout>
  </div>
</template>

<script lang="ts">
  import PageLayout from './PageLayout';
  import DocumentHeader from './DocumentHeader';
  import DocumentList from './DocumentList';

  import gql from 'graphql-tag';
  import { useQuery } from '@vue/apollo-composable';
  import { defineComponent } from 'vue';

  export default defineComponent({
    name: 'DocumentScreen',
    setup() {
      const { result, loading, error } = useQuery(gql`
        query AllInfoQuery {
          user {
            userID
            name
          }
          document {
            id
            userID
            title
            brief
            status
          }
          subdocuments {
            id
            userID
            title
            content
            status
          }
        }
      `);

      return {
        result,
        loading,
        error,
      };
    },
  });
</script>
```

```svelte filename="YourPage.svelte" renderer="svelte" language="js"
<script>
  import gql from 'graphql-tag';
  import { query } from 'svelte-apollo';
  import PageLayout from './PageLayout.svelte';
  import DocumentHeader from './DocumentHeader.svelte';
  import DocumentList from './DocumentList.svelte';

  const AllInfoQuery = gql`
    query AllInfoQuery {
      user {
        userID
        name
      }
      document {
        id
        userID
        title
        brief
        status
      }
      subdocuments {
        id
        userID
        title
        content
        status
      }
    }
  `;
  const infoResult = query(AllInfoQuery);
</script>

{#if $infoResult.loading}
<p>Loading...</p>
{:else if $infoResult.error}
<p>There was an error fetching the data!</p>
{:else}
<PageLayout {$infoResult.data.user}>
  <DocumentHeader {$infoResult.data.document} />
  <DocumentList {$infoResult.data.subdocuments} />
</PageLayout>
{/if}
```

```svelte filename="YourPage.svelte" renderer="svelte" language="ts"
<script lang="ts">
  import gql from 'graphql-tag';
  import { query } from 'svelte-apollo';
  import PageLayout from './PageLayout.svelte';
  import DocumentHeader from './DocumentHeader.svelte';
  import DocumentList from './DocumentList.svelte';

  const AllInfoQuery = gql`
    query AllInfoQuery {
      user {
        userID
        name
      }
      document {
        id
        userID
        title
        brief
        status
      }
      subdocuments {
        id
        userID
        title
        content
        status
      }
    }
  `;
  const infoResult = query(AllInfoQuery);
</script>

{#if $infoResult.loading}
<p>Loading...</p>
{:else if $infoResult.error}
<p>There was an error fetching the data!</p>
{:else}
<PageLayout {$infoResult.data.user}>
  <DocumentHeader {$infoResult.data.document} />
  <DocumentList {$infoResult.data.subdocuments} />
</PageLayout>
{/if}
```
