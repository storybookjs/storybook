```tsx filename=".storybook/preview.tsx" renderer="solid" language="ts"
import { createJSXDecorator } from 'storybook-solidjs-vite';

export const withLayout = createJSXDecorator((Story, context) => (
  <main data-theme={context.globals.theme}>
    <Story />
  </main>
));
```
