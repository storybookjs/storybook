```tsx filename="Button.test.tsx" renderer="react" language="ts"
import { test } from 'vitest';
import { render } from '@testing-library/react';
import { composeStory } from '@storybook/react';

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
import { composeStory } from '@storybook/svelte';

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
import { composeStory } from '@storybook/vue3';

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
