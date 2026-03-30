```js filename=".storybook/preview.jsx" renderer="common" language="js" tabTitle="CSF 3"
import MockDate from 'mockdate';

export default {
  async beforeEach() {
    MockDate.reset();
  },
};
```

```ts filename=".storybook/preview.tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Preview } from '@storybook/your-framework';

import MockDate from 'mockdate';

const preview: Preview = {
  async beforeEach() {
    MockDate.reset();
  },
};

export default preview;
```

```ts filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import MockDate from 'mockdate';

export default definePreview({
  async beforeEach() {
    MockDate.reset();
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import MockDate from 'mockdate';

export default definePreview({
  async beforeEach() {
    MockDate.reset();
  },
});
```

```ts filename=".storybook/preview.tsx" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

import MockDate from 'mockdate';

export default definePreview({
  async beforeEach() {
    MockDate.reset();
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.jsx" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

import MockDate from 'mockdate';

export default definePreview({
  async beforeEach() {
    MockDate.reset();
  },
});
```

```ts filename=".storybook/preview.tsx" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/angular';

import MockDate from 'mockdate';

export default definePreview({
  async beforeEach() {
    MockDate.reset();
  },
});
```

```ts filename=".storybook/preview.tsx" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/web-components-vite';

import MockDate from 'mockdate';

export default definePreview({
  async beforeEach() {
    MockDate.reset();
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.jsx" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/web-components-vite';

import MockDate from 'mockdate';

export default definePreview({
  async beforeEach() {
    MockDate.reset();
  },
});
```
