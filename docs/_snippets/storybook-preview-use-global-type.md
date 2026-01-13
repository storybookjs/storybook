```ts filename=".storybook/preview.js" renderer="angular" language="ts"
import type { Preview } from '@storybook/angular';
import { componentWrapperDecorator } from '@storybook/angular';

const preview: Preview = {
  decorators: [
    componentWrapperDecorator(
      (story) => `<div [class]="myTheme">${story}</div>`,
      ({ globals }) => {
        return { myTheme: globals['theme'] };
      },
    ),
  ],
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { componentWrapperDecorator, definePreview } from '@storybook/angular';

export default definePreview({
  decorators: [
    componentWrapperDecorator(
      (story) => `<div [class]="myTheme">${story}</div>`,
      ({ globals }) => {
        return { myTheme: globals['theme'] };
      },
    ),
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="angular" language="js" tabTitle="CSF Next 🧪"
import { componentWrapperDecorator, definePreview } from '@storybook/angular';

export default definePreview({
  decorators: [
    componentWrapperDecorator(
      (story) => `<div [class]="myTheme">${story}</div>`,
      ({ globals }) => {
        return { myTheme: globals['theme'] };
      },
    ),
  ],
});
```

```jsx filename=".storybook/preview.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { ThemeProvider } from 'styled-components';

import { MyThemes } from '../my-theme-folder/my-theme-file';

const preview = {
  decorators: [
    (Story, context) => {
      const theme = MyThemes[context.globals.theme];
      return (
        <ThemeProvider theme={theme}>
          <Story />
        </ThemeProvider>
      );
    },
  ],
};

export default preview;
```

```tsx filename=".storybook/preview.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Preview } from '@storybook/your-framework';

import { ThemeProvider } from 'styled-components';

import { MyThemes } from '../my-theme-folder/my-theme-file';

const preview: Preview = {
  decorators: [
    (Story, context) => {
      const theme = MyThemes[context.globals.theme];
      return (
        <ThemeProvider theme={theme}>
          <Story />
        </ThemeProvider>
      );
    },
  ],
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="CSF 3"
import { setup } from '@storybook/vue3-vite';

import { VApp } from 'vuetify/components';

import { registerPlugins } from '../src/plugins';

setup((app) => {
  // Registers your app's plugins including Vuetify into Storybook
  registerPlugins(app);
});

const preview = {
  decorators: [
    (story, context) => {
      const theme = context.globals.theme || 'light';
      return {
        components: { story, VApp },
        template: `
          <v-app theme="${theme}">
            <div>
              <story/>
            </div>
          </v-app>
      `,
      };
    },
  ],
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="CSF 3"
import type { Preview } from '@storybook/vue3-vite';

import { setup } from '@storybook/vue3-vite';

import { VApp } from 'vuetify/components';

import { registerPlugins } from '../src/plugins';

setup((app) => {
  // Registers your app's plugins including Vuetify into Storybook
  registerPlugins(app);
});

const preview: Preview = {
  decorators: [
    (story, context) => {
      const theme = context.globals.theme || 'light';
      return {
        components: { story, VApp },
        template: `
          <v-app theme="${theme}">
            <div class="d-flex">
              <story/>
            </div>
          </v-app>
      `,
      };
    },
  ],
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { definePreview, setup } from '@storybook/vue3-vite';

import { VApp } from 'vuetify/components';

import { registerPlugins } from '../src/plugins';

setup((app) => {
  // Registers your app's plugins including Vuetify into Storybook
  registerPlugins(app);
});

export default definePreview({
  decorators: [
    (story, context) => {
      const theme = context.globals.theme || 'light';
      return {
        components: { story, VApp },
        template: `
          <v-app theme="${theme}">
            <div class="d-flex">
              <story/>
            </div>
          </v-app>
      `,
      };
    },
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { definePreview, setup } from '@storybook/vue3-vite';

import { VApp } from 'vuetify/components';

import { registerPlugins } from '../src/plugins';

setup((app) => {
  // Registers your app's plugins including Vuetify into Storybook
  registerPlugins(app);
});

export default definePreview({
  decorators: [
    (story, context) => {
      const theme = context.globals.theme || 'light';
      return {
        components: { story, VApp },
        template: `
          <v-app theme="${theme}">
            <div>
              <story/>
            </div>
          </v-app>
      `,
      };
    },
  ],
});
```

```tsx filename=".storybook/preview.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { ThemeProvider } from 'styled-components';

import { MyThemes } from '../my-theme-folder/my-theme-file';

export default definePreview({
  decorators: [
    (Story, context) => {
      const theme = MyThemes[context.globals.theme];
      return (
        <ThemeProvider theme={theme}>
          <Story />
        </ThemeProvider>
      );
    },
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```jsx filename=".storybook/preview.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';
import { ThemeProvider } from 'styled-components';

import { MyThemes } from '../my-theme-folder/my-theme-file';

export default definePreview({
  decorators: [
    (Story, context) => {
      const theme = MyThemes[context.globals.theme];
      return (
        <ThemeProvider theme={theme}>
          <Story />
        </ThemeProvider>
      );
    },
  ],
});
```
