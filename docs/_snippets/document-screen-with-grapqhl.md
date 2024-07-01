```html renderer="svelte" language="js"
{/* YourPage.svelte */}

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

```html renderer="svelte" language="ts"
{/* YourPage.svelte */}

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

