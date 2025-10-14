```ts filename="Button.stories.portable.ts" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { composeStory } from '@storybook/your-framework';

import meta, { Primary } from './Button.stories';

export const PrimaryEnglish = composeStory(
  Primary,
  meta,
  { globals: { locale: 'en' } }, // 👈 Project annotations to override the locale
);

export const PrimarySpanish = composeStory(Primary, meta, { globals: { locale: 'es' } });
```

```ts filename="Button.stories.portable.ts" renderer="vue" language="ts"
import { composeStory } from '@storybook/vue3-vite';

import meta, { Primary } from './Button.stories';

export const PrimaryEnglish = composeStory(
  Primary,
  meta,
  { globals: { locale: 'en' } }, // 👈 Project annotations to override the locale
);

export const PrimarySpanish = composeStory(Primary, meta, { globals: { locale: 'es' } });
```

```ts filename="Button.stories.portable.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import { Primary } from './Button.stories';

export const PrimaryEnglish = Primary.extend({
  globals: { locale: 'en' }, // 👈 Project annotations to override the locale
});

export const PrimarySpanish = Primary.extend({
  globals: { locale: 'es' },
});
```
