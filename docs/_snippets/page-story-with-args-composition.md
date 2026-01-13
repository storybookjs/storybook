```ts filename="YourPage.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/angular';

import { DocumentScreen } from './YourPage.component';

// 👇 Imports the required stories
import * as PageLayout from './PageLayout.stories';
import * as DocumentHeader from './DocumentHeader.stories';
import * as DocumentList from './DocumentList.stories';

const meta: Meta<DocumentScreen> = {
  component: DocumentScreen,
};

export default meta;
type Story = StoryObj<DocumentScreen>;

export const Simple: Story = {
  args: {
    user: PageLayout.Simple.args.user,
    document: DocumentHeader.Simple.args.document,
    subdocuments: DocumentList.Simple.args.documents,
  },
};
```

```ts filename="YourPage.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { DocumentScreen } from './YourPage.component';

// 👇 Imports the required stories
import * as PageLayout from './PageLayout.stories';
import * as DocumentHeader from './DocumentHeader.stories';
import * as DocumentList from './DocumentList.stories';

const meta = preview.meta({
  component: DocumentScreen,
});

export const Simple = meta.story({
  args: {
    user: PageLayout.Simple.input.args.user,
    document: DocumentHeader.Simple.input.args.document,
    subdocuments: DocumentList.Simple.input.args.documents,
  },
});
```

```svelte filename="YourPage.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import DocumentScreen from './YourPage.svelte';

  // 👇 Imports the required stories
  import * as PageLayout from './PageLayout.stories.svelte';
  import * as DocumentHeader from './DocumentHeader.stories.svelte';
  import * as DocumentList from './DocumentList.stories.svelte';

  const { Story } = defineMeta({
    component: DocumentScreen,
  });
</script>

<Story
  name="Simple"
  args={{
    user: PageLayout.Simple.args.user,
    document: DocumentHeader.Simple.args.document,
    subdocuments: DocumentList.Simple.args.documents,
  }}
/>
```

```js filename="YourPage.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import DocumentScreen from './YourPage.svelte';

// 👇 Imports the required stories
import * as PageLayout from './PageLayout.stories';
import * as DocumentHeader from './DocumentHeader.stories';
import * as DocumentList from './DocumentList.stories';

export default {
  component: DocumentScreen,
};

export const Simple = {
  args: {
    user: PageLayout.Simple.args.user,
    document: DocumentHeader.Simple.args.document,
    subdocuments: DocumentList.Simple.args.documents,
  },
};
```

```js filename="YourPage.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { DocumentScreen } from './YourPage';

// 👇 Imports the required stories
import * as PageLayout from './PageLayout.stories';
import * as DocumentHeader from './DocumentHeader.stories';
import * as DocumentList from './DocumentList.stories';

export default {
  component: DocumentScreen,
};

export const Simple = {
  args: {
    user: PageLayout.Simple.args.user,
    document: DocumentHeader.Simple.args.document,
    subdocuments: DocumentList.Simple.args.documents,
  },
};
```

```svelte filename="YourPage.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import DocumentScreen from './YourPage.svelte';

  // 👇 Imports the required stories
  import * as PageLayout from './PageLayout.stories.svelte';
  import * as DocumentHeader from './DocumentHeader.stories.svelte';
  import * as DocumentList from './DocumentList.stories.svelte';

  const { Story } = defineMeta({
    component: DocumentScreen,
  });
</script>

<Story
  name="Simple"
  args={{
    user: PageLayout.Simple.args.user,
    document: DocumentHeader.Simple.args.document,
    subdocuments: DocumentList.Simple.args.documents,
  }}
/>
```

```ts filename="YourPage.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import DocumentScreen from './YourPage.svelte';

// 👇 Imports the required stories
import * as PageLayout from './PageLayout.stories';
import * as DocumentHeader from './DocumentHeader.stories';
import * as DocumentList from './DocumentList.stories';

const meta = {
  component: DocumentScreen,
} satisfies Meta<typeof DocumentScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Simple: Story = {
  args: {
    user: PageLayout.Simple.args.user,
    document: DocumentHeader.Simple.args.document,
    subdocuments: DocumentList.Simple.args.documents,
  },
};
```

```ts filename="YourPage.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { DocumentScreen } from './YourPage';

// 👇 Imports the required stories
import * as PageLayout from './PageLayout.stories';
import * as DocumentHeader from './DocumentHeader.stories';
import * as DocumentList from './DocumentList.stories';

const meta = {
  component: DocumentScreen,
} satisfies Meta<typeof DocumentScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Simple: Story = {
  args: {
    user: PageLayout.Simple.args.user,
    document: DocumentHeader.Simple.args.document,
    subdocuments: DocumentList.Simple.args.documents,
  },
};
```

```js filename="YourPage.stories.js" renderer="web-components" language="js"
// 👇 Imports the required stories
import * as PageLayout from './PageLayout.stories';
import * as DocumentHeader from './DocumentHeader.stories';
import * as DocumentList from './DocumentList.stories';

export default {
  component: 'demo-document-screen',
};

export const Simple = {
  args: {
    user: PageLayout.Simple.args.user,
    document: DocumentHeader.Simple.args.document,
    subdocuments: DocumentList.Simple.args.documents,
  },
};
```

```ts filename="YourPage.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

// 👇 Imports the required stories
import PageLayout from './PageLayout.stories';
import DocumentHeader from './DocumentHeader.stories';
import DocumentList from './DocumentList.stories';

const meta: Meta = {
  component: 'demo-document-screen',
};

export default meta;
type Story = StoryObj;

export const Simple: Story = {
  args: {
    user: PageLayout.Simple.args.user,
    document: DocumentHeader.Simple.args.document,
    subdocuments: DocumentList.Simple.args.documents,
  },
};
```

```ts filename="YourPage.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { DocumentScreen } from './YourPage';

// 👇 Imports the required stories
import * as PageLayout from './PageLayout.stories';
import * as DocumentHeader from './DocumentHeader.stories';
import * as DocumentList from './DocumentList.stories';

const meta = preview.meta({
  component: DocumentScreen,
});

export const Simple = meta.story({
  args: {
    user: PageLayout.Simple.input.args.user,
    document: DocumentHeader.Simple.input.args.document,
    subdocuments: DocumentList.Simple.input.args.documents,
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="YourPage.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { DocumentScreen } from './YourPage';

// 👇 Imports the required stories
import * as PageLayout from './PageLayout.stories';
import * as DocumentHeader from './DocumentHeader.stories';
import * as DocumentList from './DocumentList.stories';

const meta = preview.meta({
  component: DocumentScreen,
});

export const Simple = meta.story({
  args: {
    user: PageLayout.Simple.input.args.user,
    document: DocumentHeader.Simple.input.args.document,
    subdocuments: DocumentList.Simple.input.args.documents,
  },
});
```

```ts filename="YourPage.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import DocumentScreen from './YourPage.vue';

// 👇 Imports the required stories
import * as PageLayout from './PageLayout.stories';
import * as DocumentHeader from './DocumentHeader.stories';
import * as DocumentList from './DocumentList.stories';

const meta = preview.meta({
  component: DocumentScreen,
});

export const Simple = meta.story({
  args: {
    user: PageLayout.Simple.input.args.user,
    document: DocumentHeader.Simple.input.args.document,
    subdocuments: DocumentList.Simple.input.args.documents,
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="YourPage.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import DocumentScreen from './YourPage.vue';

// 👇 Imports the required stories
import * as PageLayout from './PageLayout.stories';
import * as DocumentHeader from './DocumentHeader.stories';
import * as DocumentList from './DocumentList.stories';

const meta = preview.meta({
  component: DocumentScreen,
});

export const Simple = meta.story({
  args: {
    user: PageLayout.Simple.input.args.user,
    document: DocumentHeader.Simple.input.args.document,
    subdocuments: DocumentList.Simple.input.args.documents,
  },
});
```
