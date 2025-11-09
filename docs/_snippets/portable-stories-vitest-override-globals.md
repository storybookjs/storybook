```tsx filename="Button.test.tsx" renderer="react" language="ts"
import { test } from 'vitest';
import { render } from '@testing-library/react';
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { composeStory } from '@storybook/your-framework';

import meta, { Primary as PrimaryStory } from './Button.stories';

test('renders in English', async () => {
  const Primary = composeStory(
    PrimaryStory,
    meta,
    { globals: { locale: 'en' } }, // 👈 Project annotations to override the locale
  );

  await Primary.run();
});

test('renders in Spanish', async () => {
  const Primary = composeStory(PrimaryStory, meta, { globals: { locale: 'es' } });

  await Primary.run();
});
```

```ts filename="Button.test.ts" renderer="svelte" language="ts"
import { test } from 'vitest';
import { render } from '@testing-library/svelte';
// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
import { composeStory } from '@storybook/your-framework';

import meta, { Primary as PrimaryStory } from './Button.stories';

test('renders in English', async () => {
  const Primary = composeStory(
    PrimaryStory,
    meta,
    { globals: { locale: 'en' } }, // 👈 Project annotations to override the locale
  );

  await Primary.run();
});

test('renders in Spanish', async () => {
  const Primary = composeStory(PrimaryStory, meta, { globals: { locale: 'es' } });

  await Primary.run();
});
```

```ts filename="Button.test.ts" renderer="vue" language="ts"
import { test } from 'vitest';
import { render } from '@testing-library/vue';
import { composeStory } from '@storybook/vue3-vite';

import meta, { Primary as PrimaryStory } from './Button.stories';

test('renders in English', async () => {
  const Primary = composeStory(
    PrimaryStory,
    meta,
    { globals: { locale: 'en' } }, // 👈 Project annotations to override the locale
  );

  await Primary.run();
});

test('renders in Spanish', async () => {
  const Primary = composeStory(PrimaryStory, meta, { globals: { locale: 'es' } });

  await Primary.run();
});
```
