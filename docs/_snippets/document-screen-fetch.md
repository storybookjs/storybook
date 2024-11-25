```ts filename="YourPage.component.ts" renderer="angular" language="ts"
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'document-screen',
  template: `
    <div>
      <div *ngIf="error"><p>There was an error fetching the data!</p></div>
      <div *ngIf="loading"><p>Loading...</p></div>
      <div *ngIf="!loading && subdocuments.length > 0">
        <page-layout [user]="user">
          <document-header [document]="document"></document-header>
          <document-list [documents]="subdocuments"></document-list>
        </page-layout>
      </div>
    </div>
  `,
})
export class DocumentScreen implements OnInit {
  user: any = { id: 0, name: 'Some User' };

  document: any = { id: 0, title: 'Some Title' };

  subdocuments: any = [];

  error = false;
  loading = true;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<any>('https://your-restful-endpoint').subscribe({
      next: (data) => {
        this.loading = false;
        this.user = data.user;
        this.document = data.document;
        this.documents.data.subdocuments;
      },
      error: (error) => {
        this.error = true;
      },
    });
  }
}
```

```js filename="YourPage.jsx" renderer="react" language="js"
import React, { useState, useEffect } from 'react';

import { PageLayout } from './PageLayout';
import { DocumentHeader } from './DocumentHeader';
import { DocumentList } from './DocumentList';

// Example hook to retrieve data from an external endpoint
function useFetchData() {
  const [status, setStatus] = useState('idle');
  const [data, setData] = useState([]);
  useEffect(() => {
    setStatus('loading');
    fetch('https://your-restful-endpoint')
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.statusText);
        }
        return res;
      })
      .then((res) => res.json())
      .then((data) => {
        setStatus('success');
        setData(data);
      })
      .catch(() => {
        setStatus('error');
      });
  }, []);
  return {
    status,
    data,
  };
}
export function DocumentScreen() {
  const { status, data } = useFetchData();

  const { user, document, subdocuments } = data;

  if (status === 'loading') {
    return <p>Loading...</p>;
  }
  if (status === 'error') {
    return <p>There was an error fetching the data!</p>;
  }
  return (
    <PageLayout user={user}>
      <DocumentHeader document={document} />
      <DocumentList documents={subdocuments} />
    </PageLayout>
  );
}
```

```ts filename="YourPage.tsx" renderer="react" language="ts"
import React, { useState, useEffect } from 'react';

import { PageLayout } from './PageLayout';
import { DocumentHeader } from './DocumentHeader';
import { DocumentList } from './DocumentList';

// Example hook to retrieve data from an external endpoint
function useFetchData() {
  const [status, setStatus] = useState<string>('idle');
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    setStatus('loading');
    fetch('https://your-restful-endpoint')
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.statusText);
        }
        return res;
      })
      .then((res) => res.json())
      .then((data) => {
        setStatus('success');
        setData(data);
      })
      .catch(() => {
        setStatus('error');
      });
  }, []);

  return {
    status,
    data,
  };
}

export function DocumentScreen() {
  const { status, data } = useFetchData();

  const { user, document, subdocuments } = data;

  if (status === 'loading') {
    return <p>Loading...</p>;
  }
  if (status === 'error') {
    return <p>There was an error fetching the data!</p>;
  }
  return (
    <PageLayout user={user}>
      <DocumentHeader document={document} />
      <DocumentList documents={subdocuments} />
    </PageLayout>
  );
}
```

```js filename="YourPage.jsx" renderer="solid" language="js"
import { createSignal, Match, Switch } from 'solid-js';

import { PageLayout } from './PageLayout';
import { DocumentHeader } from './DocumentHeader';
import { DocumentList } from './DocumentList';

// Example hook to retrieve data from an external endpoint
function useFetchData() {
  const [status, setStatus] = createSignal('idle');
  const [data, setData] = createSignal([]);

  setStatus('loading');
  fetch('https://your-restful-endpoint')
    .then((res) => {
      if (!res.ok) {
        throw new Error(res.statusText);
      }
      return res;
    })
    .then((res) => res.json())
    .then((data) => {
      setStatus('success');
      setData(data);
    })
    .catch(() => {
      setStatus('error');
    });

  return {
    status,
    data,
  };
}
export function DocumentScreen() {
  const { status, data } = useFetchData();

  return (
    <Switch>
      <Match when={status() === 'loading'}>
        <p>Loading...</p>
      </Match>
      <Match when={status() === 'error'}>
        <p>There was an error fetching the data!</p>
      </Match>
      <Match when={user} keyed>
        <PageLayout user={data().user}>
          <DocumentHeader document={data().document} />
          <DocumentList documents={data().subdocuments} />
        </PageLayout>
      </Match>
    </Switch>
  );
}
```

```svelte filename="YourPage.svelte" renderer="svelte" language="js"
<script>
  import { onMount } from 'svelte';

  import PageLayout from './PageLayout.svelte';
  import DocumentHeader from './DocumentHeader.svelte';
  import DocumentList from './DocumentList.svelte';

  export let user = {};
  export let document = {};
  export let subdocuments = [];
  export let status = 'loading';

  onMount(async () => {
    await fetch('https://your-restful-endpoint')
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.statusText);
        }
        return res;
      })
      .then((res) => res.json())
      .then((data) => {
        user = data.user;
        status = 'success';
        document = data.document;
        subdocuments = data.subdocuments;
      })
      .catch(() => {
        status = 'error';
      });
  });
</script>

{#if status === "error"}
<p>There was an error fetching the data!</p>
{:else if status === "loading"}
<p>Loading...</p>
{:else}
<PageLayout {user}>
  <DocumentHeader {document} />
  <DocumentList documents="{subdocuments}" />
</PageLayout>
{/if}
```

```svelte filename="YourPage.svelte" renderer="svelte" language="ts"
<script lang="ts">
  import { onMount } from 'svelte';

  import PageLayout from './PageLayout.svelte';
  import DocumentHeader from './DocumentHeader.svelte';
  import DocumentList from './DocumentList.svelte';

  export let user: Record<string, unknown> = {};
  export let document: Record<string, unknown> = {};
  export let subdocuments: Record<string, unknown>[] = [];
  export let status: 'error' | 'loading' | 'success' = 'loading';

  onMount(async () => {
    await fetch('https://your-restful-endpoint')
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.statusText);
        }
        return res;
      })
      .then((res) => res.json())
      .then((data) => {
        user = data.user;
        status = 'success';
        document = data.document;
        subdocuments = data.subdocuments;
      })
      .catch(() => {
        status = 'error';
      });
  });
</script>

{#if status === "error"}
<p>There was an error fetching the data!</p>
{:else if status === "loading"}
<p>Loading...</p>
{:else}
<PageLayout {user}>
  <DocumentHeader {document} />
  <DocumentList documents="{subdocuments}" />
</PageLayout>
{/if}
```

```html filename="YourPage.vue" renderer="vue" language="js"
<template>
  <div v-if="!loading && data && data.subdocuments.length">
    <PageLayout :user="data.user">
      <DocumentHeader :document="data.document" />
      <DocumentList :documents="data.subdocuments" />
    </PageLayout>
  </div>
  <p v-if="loading">Loading...</p>
  <p v-if="error">There was an error fetching the data!</p>
</template>
<script>
  import { ref } from 'vue';

  import PageLayout from './PageLayout';
  import DocumentHeader from './DocumentHeader';
  import DocumentList from './DocumentList';

  export default {
    name: 'DocumentScreen',
    setup() {
      const data = ref(null);
      const loading = ref(true);
      const error = ref(null);
      fetch('https://your-restful-endpoint')
        .then((res) => {
          if (!res.ok) {
            error.value = res.statusText;
          }
          return res;
        })
        .then((res) => res.json())
        .then((requestData) => {
          data.value = requestData;
          loading.value = false;
        })
        .catch(() => {
          error.value = 'error';
        });
      return {
        error,
        loading,
        data,
      };
    },
  };
</script>
```

```html filename="YourPage.vue" renderer="vue" language="ts"
<template>
  <div v-if="!loading && data && data.subdocuments.length">
    <PageLayout :user="data.user">
      <DocumentHeader :document="data.document" />
      <DocumentList :documents="data.subdocuments" />
    </PageLayout>
  </div>
  <p v-if="loading">Loading...</p>
  <p v-if="error">There was an error fetching the data!</p>
</template>
<script lang="ts">
  import { defineComponent, ref } from 'vue';
  import PageLayout from './PageLayout';
  import DocumentHeader from './DocumentHeader';
  import DocumentList from './DocumentList';

  export default defineComponent({
    name: 'SampleRestComponent',
    components: {
      PageLayout,
      DocumentHeader,
      DocumentList,
    },
    setup() {
      const data = ref(null);
      const loading = ref(true);
      const error = ref(null);
      fetch('https://your-restful-endpoint')
        .then((res) => {
          if (!res.ok) {
            error.value = res.statusText;
          }
          return res;
        })
        .then((res) => res.json())
        .then((requestData) => {
          data.value = requestData;
          loading.value = false;
        })
        .catch(() => {
          error.value = 'error';
        });
      return {
        error,
        loading,
        data,
      };
    },
  });
</script>
```

```js filename="YourPage.js" renderer="web-components" language="js"
import { LitElement, html } from 'lit-element';

class DocumentScreen extends LitElement {
  static get properties() {
    return {
      _data: { type: Object },
      _status: { state: true },
    };
  }

  constructor() {
    super();
    this._status = 'idle';
  }

  connectedCallback() {
    super.connectedCallback();
    this.fetchData();
  }

  fetchData() {
    this._status = 'loading';

    fetch('https://your-restful-endpoint')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        response.json();
      })
      .then((data) => {
        this._status = 'success';
        this._data = data;
      })
      .catch((error) => {
        this._status = 'error';
      });
  }

  render() {
    if (this._status === 'error') {
      return html`<p>There was an error fetching the data!</p>`;
    }

    if (this._status === 'loading') {
      return html`<p>Loading...</p>`;
    }

    const { user, document, subdocuments } = this._data;
    return html`
      <demo-page-layout .user=${user}>
        <demo-document-header .document=${document}></demo-document-header>
        <demo-document-list .documents=${subdocuments}></demo-document-list>
      </demo-page-layout>
    `;
  }
}

customElements.define('demo-document-screen', DocumentScreen);
```
