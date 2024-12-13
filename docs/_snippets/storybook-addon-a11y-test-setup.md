```ts filename=".storybook/vitest.setup.ts" renderer="react" language="ts"
import { beforeAll } from 'vitest';

import { setProjectAnnotations } from '@storybook/react';

// Import the a11y addon annotations
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';

// Optionally import your own annotations
import * as projectAnnotations from './preview';

const project = setProjectAnnotations([
  // Add the a11y addon annotations
  a11yAddonAnnotations,
  projectAnnotations,
]);

beforeAll(project.beforeAll);
```

```js filename=".storybook/vitest.setup.js" renderer="react" language="js"
import { beforeAll } from 'vitest';

import { setProjectAnnotations } from '@storybook/react';

// Import the a11y addon annotations
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';

// Optionally import your own annotations
import * as projectAnnotations from './preview';

const project = setProjectAnnotations([
  // Add the a11y addon annotations
  a11yAddonAnnotations,
  projectAnnotations,
]);

beforeAll(project.beforeAll);
```

```ts filename=".storybook/vitest.setup.ts" renderer="svelte" language="ts"
import { beforeAll } from 'vitest';

// Replace @storybook/svelte with @storybook/sveltekit if you are using SvelteKit
import { setProjectAnnotations } from '@storybook/svelte';

// Import the a11y addon annotations
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';

// Optionally import your own annotations
import * as projectAnnotations from './preview';

const project = setProjectAnnotations([
  // Add the a11y addon annotations
  a11yAddonAnnotations,
  projectAnnotations,
]);

beforeAll(project.beforeAll);
```

```js filename=".storybook/vitest.setup.js" renderer="svelte" language="js"
import { beforeAll } from 'vitest';

// Replace @storybook/svelte with @storybook/sveltekit if you are using SvelteKit
import { setProjectAnnotations } from '@storybook/svelte';

// Import the a11y addon annotations
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';

// Optionally import your own annotations
import * as projectAnnotations from './preview';

const project = setProjectAnnotations([
  // Add the a11y addon annotations
  a11yAddonAnnotations,
  projectAnnotations,
]);

beforeAll(project.beforeAll);
```

```ts filename=".storybook/vitest.setup.ts" renderer="vue" language="ts"
import { beforeAll } from 'vitest';

import { setProjectAnnotations } from '@storybook/vue3';

// Import the a11y addon annotations
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';

// Optionally import your own annotations
import * as projectAnnotations from './preview';

const project = setProjectAnnotations([
  // Add the a11y addon annotations
  a11yAddonAnnotations,
  projectAnnotations,
]);

beforeAll(project.beforeAll);
```

```js filename=".storybook/vitest.setup.js" renderer="vue" language="js"
import { beforeAll } from 'vitest';

import { setProjectAnnotations } from '@storybook/vue3';

// Import the a11y addon annotations
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';

// Optionally import your own annotations
import * as projectAnnotations from './preview';

const project = setProjectAnnotations([
  // Add the a11y addon annotations
  a11yAddonAnnotations,
  projectAnnotations,
]);

beforeAll(project.beforeAll);
```
