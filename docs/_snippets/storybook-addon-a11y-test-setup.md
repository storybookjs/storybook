```ts filename=".storybook/vitest.setup.ts" renderer="react" language="ts"
import { setProjectAnnotations } from '@storybook/react';

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
import { setProjectAnnotations } from '@storybook/react';

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
// Replace @storybook/svelte with @storybook/sveltekit if you are using SvelteKit
import { setProjectAnnotations } from '@storybook/svelte';

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
// Replace @storybook/svelte with @storybook/sveltekit if you are using SvelteKit
import { setProjectAnnotations } from '@storybook/svelte';

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
import { setProjectAnnotations } from '@storybook/vue3';

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
import { setProjectAnnotations } from '@storybook/vue3';

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
