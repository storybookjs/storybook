```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
import { init } from '../project-bootstrap';

export default {
  async beforeAll() {
    await init();
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Preview } from '@storybook/your-framework';

import { init } from '../project-bootstrap';

const preview: Preview = {
  async beforeAll() {
    await init();
  },
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { init } from '../project-bootstrap';

export default definePreview({
  async beforeAll() {
    await init();
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { init } from '../project-bootstrap';

export default definePreview({
  async beforeAll() {
    await init();
  },
});
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

import { init } from '../project-bootstrap';

export default definePreview({
  async beforeAll() {
    await init();
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

import { init } from '../project-bootstrap';

export default definePreview({
  async beforeAll() {
    await init();
  },
});
```

```ts filename=".storybook/preview.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/angular';

import { init } from '../project-bootstrap';

export default definePreview({
  async beforeAll() {
    await init();
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="angular" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/angular';

import { init } from '../project-bootstrap';

export default definePreview({
  async beforeAll() {
    await init();
  },
});
```

```ts filename=".storybook/preview.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/web-components-vite';

import { init } from '../project-bootstrap';

export default definePreview({
  async beforeAll() {
    await init();
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/web-components-vite';

import { init } from '../project-bootstrap';

export default definePreview({
  async beforeAll() {
    await init();
  },
});
```
