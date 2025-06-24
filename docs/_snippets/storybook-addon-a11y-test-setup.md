```ts filename=".storybook/vitest.setup.ts" renderer="react" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { setProjectAnnotations } from '@storybook/your-framework';

// Import the a11y addon annotations
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';

// Optionally import your own annotations
import * as projectAnnotations from './preview';

setProjectAnnotations([
  // Add the a11y addon annotations
  a11yAddonAnnotations,
  projectAnnotations,
]);
```

```js filename=".storybook/vitest.setup.js" renderer="react" language="js"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { setProjectAnnotations } from '@storybook/your-framework';

// Import the a11y addon annotations
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';

// Optionally import your own annotations
import * as projectAnnotations from './preview';

setProjectAnnotations([
  // Add the a11y addon annotations
  a11yAddonAnnotations,
  projectAnnotations,
]);
```

```ts filename=".storybook/vitest.setup.ts" renderer="svelte" language="ts"
// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
import { setProjectAnnotations } from '@storybook/your-framework';

// Import the a11y addon annotations
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';

// Optionally import your own annotations
import * as projectAnnotations from './preview';

setProjectAnnotations([
  // Add the a11y addon annotations
  a11yAddonAnnotations,
  projectAnnotations,
]);
```

```js filename=".storybook/vitest.setup.js" renderer="svelte" language="js"
// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
import { setProjectAnnotations } from '@storybook/your-framework';

// Import the a11y addon annotations
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';

// Optionally import your own annotations
import * as projectAnnotations from './preview';

setProjectAnnotations([
  // Add the a11y addon annotations
  a11yAddonAnnotations,
  projectAnnotations,
]);
```

```ts filename=".storybook/vitest.setup.ts" renderer="vue" language="ts"
import { setProjectAnnotations } from '@storybook/vue3-vite';

// Import the a11y addon annotations
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';

// Optionally import your own annotations
import * as projectAnnotations from './preview';

setProjectAnnotations([
  // Add the a11y addon annotations
  a11yAddonAnnotations,
  projectAnnotations,
]);
```

```js filename=".storybook/vitest.setup.js" renderer="vue" language="js"
import { setProjectAnnotations } from '@storybook/vue3-vite';

// Import the a11y addon annotations
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';

// Optionally import your own annotations
import * as projectAnnotations from './preview';

setProjectAnnotations([
  // Add the a11y addon annotations
  a11yAddonAnnotations,
  projectAnnotations,
]);
```
