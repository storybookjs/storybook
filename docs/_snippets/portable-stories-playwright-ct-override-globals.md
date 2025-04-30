```tsx filename="Button.stories.portable.ts" renderer="react" language="ts"
import { composeStory } from '@storybook/react';

import meta, { Primary } from './Button.stories';

export const PrimaryEnglish = composeStory(
  Primary,
  meta,
  { globals: { locale: 'en' } } // 👈 Project annotations to override the locale
);

export const PrimarySpanish = composeStory(Primary, meta, { globals: { locale: 'es' } });
```

```ts filename="Button.stories.portable.ts" renderer="vue" language="ts"
import { composeStory } from '@storybook/vue3';

import meta, { Primary } from './Button.stories';

export const PrimaryEnglish = composeStory(
  Primary,
  meta,
  { globals: { locale: 'en' } } // 👈 Project annotations to override the locale
);

export const PrimarySpanish = composeStory(Primary, meta, { globals: { locale: 'es' } });
```
