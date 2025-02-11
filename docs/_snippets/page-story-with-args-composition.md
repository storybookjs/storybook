<!-- TODO: Vet this example for CSF Next composition -->

```ts filename="YourPage.stories.ts" renderer="angular" language="ts"
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

```js filename="YourPage.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

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

```ts filename="YourPage.stories.ts|tsx" renderer="common" language="ts-4-9" tabTitle="CSF 3"
// Replace your-framework with the name of your framework
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

```ts filename="YourPage.stories.ts|tsx" renderer="common" language="ts-4-9" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

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

```ts filename="YourPage.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { DocumentScreen } from './YourPage';

// 👇 Imports the required stories
import * as PageLayout from './PageLayout.stories';
import * as DocumentHeader from './DocumentHeader.stories';
import * as DocumentList from './DocumentList.stories';

const meta: Meta<typeof DocumentScreen> = {
  component: DocumentScreen,
};

export default meta;
type Story = StoryObj<typeof DocumentScreen>;

export const Simple: Story = {
  args: {
    user: PageLayout.Simple.args.user,
    document: DocumentHeader.Simple.args.document,
    subdocuments: DocumentList.Simple.args.documents,
  },
};
```

```ts filename="YourPage.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

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
import type { Meta, StoryObj } from '@storybook/web-components';

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
