```ts filename="YourPage.component.ts" renderer="angular" language="ts"
import { Component, Input } from '@angular/core';

@Component({
  selector: 'document-screen',
  template: `
    <page-layout [user]="user">
      <document-header [document]="document"></document-header>
      <document-list [documents]="subdocuments"></document-list>
    </page-layout>
  `,
})
export class DocumentScreen {
  @Input()
  user: any = { id: 0, name: 'Some User' };

  @Input()
  document: any = { id: 0, title: 'Some Title' };

  @Input()
  subdocuments: any = [];
}
```

```js filename="YourPage.js|jsx" renderer="react" language="js"
import React from 'react';

import { PageLayout } from './PageLayout';
import { DocumentHeader } from './DocumentHeader';
import { DocumentList } from './DocumentList';

export function DocumentScreen({ user, document, subdocuments }) {
  return (
    <PageLayout user={user}>
      <DocumentHeader document={document} />
      <DocumentList documents={subdocuments} />
    </PageLayout>
  );
}
```

```tsx filename="YourPage.ts|tsx" renderer="react" language="ts"
import PageLayout from './PageLayout';
import Document from './Document';
import SubDocuments from './SubDocuments';
import DocumentHeader from './DocumentHeader';
import DocumentList from './DocumentList';

export interface DocumentScreenProps {
  user?: {};
  document?: Document;
  subdocuments?: SubDocuments[];
}

export function DocumentScreen({ user, document, subdocuments }: DocumentScreenProps) {
  return (
    <PageLayout user={user}>
      <DocumentHeader document={document} />
      <DocumentList documents={subdocuments} />
    </PageLayout>
  );
}
```

```js filename="YourPage.js|jsx" renderer="solid" language="js"
import { PageLayout } from './PageLayout';
import { DocumentHeader } from './DocumentHeader';
import { DocumentList } from './DocumentList';

export function DocumentScreen({ user, document, subdocuments }) {
  return (
    <PageLayout user={user}>
      <DocumentHeader document={document} />
      <DocumentList documents={subdocuments} />
    </PageLayout>
  );
}
```

```tsx filename="YourPage.ts|tsx" renderer="solid" language="ts"
import PageLayout from './PageLayout';
import Document from './Document';
import SubDocuments from './SubDocuments';
import DocumentHeader from './DocumentHeader';
import DocumentList from './DocumentList';

export interface DocumentScreen {
  user?: {};
  document?: Document;
  subdocuments?: SubDocuments[];
}

function DocumentScreen({ user, document, subdocuments }) {
  return (
    <PageLayout user={user}>
      <DocumentHeader document={document} />
      <DocumentList documents={subdocuments} />
    </PageLayout>
  );
}
```

```html renderer="svelte" language="js"
{/* YourPage.svelte */}

<script>
  import PageLayout from './PageLayout.svelte';
  import DocumentHeader from './DocumentHeader.svelte';
  import DocumentList from './DocumentList.svelte';

  export let user = {};
  export let document = {};
  export let subdocuments = [];
</script>

<div>
  <PageLayout {user}>
    <DocumentHeader {document} />
    <DocumentList documents="{subdocuments}" />
  </PageLayout>
</div>
```

```html renderer="svelte" language="ts"
{/* YourPage.svelte */}

<script lang="ts">
  import PageLayout from './PageLayout.svelte';
  import DocumentHeader from './DocumentHeader.svelte';
  import DocumentList from './DocumentList.svelte';

  export let user: Record<string, unknown> = {};
  export let document: Record<string, unknown> = {};
  export let subdocuments: Record<string, unknown>[] = [];
</script>

<div>
  <PageLayout {user}>
    <DocumentHeader {document} />
    <DocumentList documents="{subdocuments}" />
  </PageLayout>
</div>
```

```html renderer="vue" language="js" tabTitle="3"
{/* YourPage.vue */}

<template>
  <PageLayout :user="user">
    <DocumentHeader :document="document" />
    <DocumentList :documents="subdocuments" />
  </PageLayout>
</template>

<script>
  import PageLayout from './PageLayout';
  import DocumentHeader from './DocumentHeader';
  import DocumentList from './DocumentList';
  import { reactive } from 'vue';

  export default {
    name: 'DocumentScreen',
    components: { PageLayout, DocumentHeader, DocumentList },
    props: {
      user: {
        type: String,
        default: 'N/A',
      },
      document: {
        type: Object,
        default: () => ({
          id: 1,
          title: 'A document',
          content: 'Lorem Ipsum',
        }),
      },
      subdocuments: {
        type: Array,
        default: () => [],
      },
    },
    setup(props) {
      props = reactive(props);
      return {
        /**
         * What will be returned here will available to the component
         * Functions referenced here will act like methods
         */
      };
    },
  };
</script>
```

```js filename="YourPage.js" renderer="web-components" language="js"
import { LitElement, html } from 'lit-element';

class DocumentScreen extends LitElement {
  static get properties() {
    return {
      data: { type: Object },
    };
  }

  constructor() {
    super();
    this.data = {};
  }

  render() {
    const { user, document, subdocuments } = this.data;
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

```ts filename="YourPage.ts" renderer="web-components" language="ts"
import { LitElement, html } from 'lit-element';

@customElement('demo-document-screen')
class DocumentScreen extends LitElement {
  @property({ type: Object })
  data: {
    user: Record<string, unknown>;
    document: Record<string, unknown>;
    subdocuments: Array<Record<string, unknown>>;
  } = {};

  constructor() {
    super();
  }

  render() {
    const { user, document, subdocuments } = this.data;
    return html`
      <demo-page-layout .user=${user}>
        <demo-document-header .document=${document}></demo-document-header>
        <demo-document-list .documents=${subdocuments}></demo-document-list>
      </demo-page-layout>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'demo-document-screen': DocumentScreen;
  }
}
```

