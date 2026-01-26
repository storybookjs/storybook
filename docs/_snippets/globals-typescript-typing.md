```ts filename=".storybook/preview.ts" renderer="common" language="ts"
import type { Preview } from '@storybook/your-framework';

type Globals = {
  theme: 'light' | 'dark';
  locale: 'en' | 'es' | 'fr';
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
    locale: {
      description: 'Global locale for components',
      toolbar: {
        title: 'Locale',
        items: ['en', 'es', 'fr'],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
```

