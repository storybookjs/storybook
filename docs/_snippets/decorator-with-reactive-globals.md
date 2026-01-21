```js filename=".storybook/preview.js" renderer="vue" language="js"
import { computed } from 'vue';

export default {
  decorators: [
    (story, { globals }) => {
      return {
        components: { story },
        setup() {
          const greeting = computed(() => globals?.locale === 'en' ? 'Hello!' : '¡Hola!');

          return { greeting, globals };
        },
        template: `
          <div lang={{globals?.locale || 'en'}}>
            <p>Greeting: {{greeting}}</p>
            <story />
          </div>
        `,
      };
    },
  ],
};
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts"
import { computed } from 'vue';
import type { Preview } from '@storybook/vue3-vite';

const preview: Preview = {
  decorators: [
    (story, { globals }) => {
      return {
        components: { story },
        setup() {
          const greeting = computed(() => globals?.locale === 'en' ? 'Hello!' : '¡Hola!');

          return { greeting, globals };
        },
        template: `
          <div lang={{globals?.locale || 'en'}}>
            <p>Greeting: {{greeting}}</p>
            <story />
          </div>
        `,
      };
    },
  ],
};

export default preview;
```
