```ts filename=".storybook/preview.ts" renderer="angular" language="ts"
import { type Preview, componentWrapperDecorator } from '@storybook/angular';

import { ThemeProvider } from './theme-provider.component';

const preview: Preview = {
  decorators: [
    moduleMetadata({ declarations: [ThemeProvider] }),
    componentWrapperDecorator(
      (story) => `<theme-provider class="default">${story}</theme-provider>`,
    ),
  ],
};
export default preview;

// or with globals of story context
const preview: Preview = {
  decorators: [
    moduleMetadata({ declarations: [ThemeProvider] }),
    componentWrapperDecorator(
      (story) => `<theme-provider [class]="theme">${story}</theme-provider>`,
      ({ globals }) => ({ theme: globals.theme }),
    ),
  ],
};
export default preview;
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="Preview"
import { type Preview, setup } from '@storybook/vue3-vite';

import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import vuetify from '../src/plugins/vuetify';

import StoryWrapper from './StoryWrapper.vue';

// Registers the Vuetify plugin in Storybook's Vue app instance
setup((app) => {
  app.use(vuetify);
});

const preview: Preview = {
  decorators: [
    (_, { globals }) => {
      // The theme can be accessed via the story context's globals
      const themeName = globals.theme || 'light';
      return {
        components: { StoryWrapper },
        setup() {
          return { themeName };
        },
        template: `
          <StoryWrapper :themeName="themeName">
            <template #story>
              <story />
            </template>
          </StoryWrapper>
        `,
      };
    },
  ],
};

export default preview;
```

```html filename=".storybook/StoryWrapper.vue" renderer="vue" language="ts" tabTitle="Theme Provider"
<template>
  <v-app :theme="themeName">
    <v-main>
      <slot name="story"></slot>
    </v-main>
  </v-app>
</template>

<script lang="ts" setup>
  defineProps<{ themeName?: string }>();
</script>
```

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="Preview"
import { setup } from '@storybook/vue3-vite';

import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import vuetify from '../src/plugins/vuetify';

import StoryWrapper from './StoryWrapper.vue';

// Registers the Vuetify plugin in Storybook's Vue app instance
setup((app) => {
  app.use(vuetify);
});

const preview = {
  decorators: [
    (_, { globals }) => {
      // The theme can be accessed via the story context's globals
      const themeName = globals.theme || 'light';
      return {
        components: { StoryWrapper },
        setup() {
          return { themeName };
        },
        template: `
          <StoryWrapper :themeName="themeName">
            <template #story>
              <story />
            </template>
          </StoryWrapper>
        `,
      };
    },
  ],
};

export default preview;
```

```html filename=".storybook/StoryWrapper.vue" renderer="vue" language="js" tabTitle="Theme Provider"
<template>
  <v-app :theme="themeName">
    <v-main>
      <slot name="story"></slot>
    </v-main>
  </v-app>
</template>

<script>
  export default {
    name: 'StoryWrapper',
    props: {
      themeName: {
        type: String,
        default: 'light',
      },
    },
  };
</script>
```

```ts filename=".storybook/preview.ts" renderer="svelte" language="ts" tabTitle="Preview"
// Replace your-framework with svelte-vite or sveltekit
import type { Preview } from '@storybook/your-framework';

import ThemeProvider from './ThemeProvider.svelte';

const preview: Preview = {
  decorators: [
    // The theme can be accessed via the story context's globals
    (story, { globals }) => {
      return {
        Component: ThemeProvider,
        props: {
          theme: globals.theme || 'light',
          children: story,
        },
      };
    },
  ],
};

export default preview;
```

```svelte filename=".storybook/ThemeProvider.svelte" renderer="svelte" language="ts" tabTitle="Theme Provider"
<script lang="ts">
  import { BitsConfig } from 'bits-ui';

  interface Props {
    theme?: 'light' | 'dark';
    children?: import('svelte').Snippet;
  }

  let { theme = 'light', children }: Props = $props();
</script>

<BitsConfig defaultPortalTo="body">
  <div data-theme={theme} class="theme-wrapper">
    {@render children?.()}
  </div>
</BitsConfig>
```

```js filename=".storybook/preview.js" renderer="svelte" language="js" tabTitle="Preview"
import ThemeProvider from './ThemeProvider.svelte';

const preview = {
  decorators: [
    // The theme can be accessed via the story context's globals
    (story, { globals }) => {
      return {
        Component: ThemeProvider,
        props: {
          theme: globals.theme || 'light',
          children: story,
        },
      };
    },
  ],
};

export default preview;
```

```svelte filename=".storybook/ThemeProvider.svelte" renderer="svelte" language="js" tabTitle="Theme Provider"
<script>
  import { BitsConfig } from 'bits-ui';

  let { theme = 'light', children } = $props();
</script>

<BitsConfig defaultPortalTo="body">
  <div data-theme={theme} class="theme-wrapper">
    {@render children?.()}
  </div>
</BitsConfig>
```

```ts filename=".storybook/preview.ts" renderer="web-components" language="ts" tabTitle="Preview (CSF 3)"
import { html } from 'lit';

import type { Preview } from '@storybook/web-components-vite';

const preview: Preview = {
  decorators: [
    // The theme can be accessed via the story context's globals
    (story, { globals }) => {
      const theme = globals.theme || 'light';
      return html`<theme-provider theme=${theme}>${story()}</theme-provider>`;
    },
  ],
};

export default preview;
```

```ts filename=".storybook/ThemeProvider.ts" renderer="web-components" language="ts" tabTitle="Theme Provider"
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export type Theme = 'light' | 'dark';

@customElement('theme-provider')
export class ThemeProvider extends LitElement {
  @property({ type: String, reflect: true })
  theme: Theme = 'light';

  public setTheme(theme: Theme): void {
    this.theme = theme;
  }
  public getTheme(): Theme {
    return this.theme;
  }

  override render() {
    return html` <slot></slot> `;
  }
}
```

```js filename=".storybook/preview.js" renderer="web-components" language="js" tabTitle="Preview (CSF 3)"
import { html } from 'lit';

const preview = {
  decorators: [
    // The theme can be accessed via the story context's globals
    (story, { globals }) => {
      const theme = globals.theme || 'light';
      return html`<theme-provider theme=${theme}>${story()}</theme-provider>`;
    },
  ],
};

export default preview;
```

```js filename=".storybook/ThemeProvider.js" renderer="web-components" language="js" tabTitle="Theme Provider"
import { LitElement, html } from 'lit';

export class ThemeProvider extends LitElement {
  static properties = {
    theme: { type: String, reflect: true },
  };

  constructor() {
    super();
    this.theme = 'light';
  }

  setTheme(theme) {
    this.theme = theme;
  }

  getTheme() {
    return this.theme;
  }

  render() {
    return html`<slot></slot>`;
  }
}

if (!customElements.get('theme-provider')) {
  customElements.define('theme-provider', ThemeProvider);
}
```

```ts filename=".storybook/preview.ts" renderer="web-components" language="ts" tabTitle="Preview (CSF Next 🧪)"
import { html } from 'lit';

import { definePreview } from '@storybook/web-components-vite';

export default definePreview({
  decorators: [
    // The theme can be accessed via the story context's globals
    (story, { globals }) => {
      const theme = globals.theme || 'light';
      return html`<theme-provider theme=${theme}>${story()}</theme-provider>`;
    },
  ],
});
```

```ts filename=".storybook/preview.ts" renderer="web-components" language="ts" tabTitle="Preview (CSF Next 🧪)"
import { html } from 'lit';

import { definePreview } from '@storybook/web-components-vite';

export default definePreview({
  decorators: [
    // The theme can be accessed via the story context's globals
    (story, { globals }) => {
      const theme = globals.theme || 'light';
      return html`<theme-provider theme=${theme}>${story()}</theme-provider>`;
    },
  ],
});
```

```jsx filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF 3"
import React from 'react';

import { ThemeProvider } from 'styled-components';

export default {
  decorators: [
    (Story) => (
      <ThemeProvider theme="default">
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </ThemeProvider>
    ),
  ],
};
```

```tsx filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF 3"
import React from 'react';

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Preview } from '@storybook/your-framework';

import { ThemeProvider } from 'styled-components';

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider theme="default">
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </ThemeProvider>
    ),
  ],
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="solid" language="js"
import { ThemeProvider } from 'solid-styled-components';

const theme = {
  colors: {
    primary: 'hotpink',
  },
};

export const decorators = [
  (Story) => (
    <ThemeProvider theme={theme}>
      <Story />
    </ThemeProvider>
  ),
];
```

```tsx filename=".storybook/preview.tsx" renderer="solid" language="ts"
import type { Preview } from 'storybook-solidjs-vite';

import { ThemeProvider, DefaultTheme } from 'solid-styled-components';

const theme: DefaultTheme = {
  colors: {
    primary: 'hotpink',
  },
};

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider theme={theme}>
        <Story />
      </ThemeProvider>
    ),
  ],
};

export default preview;
```

```tsx filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import React from 'react';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { ThemeProvider } from 'styled-components';

export default definePreview({
  decorators: [
    (Story) => (
      <ThemeProvider theme="default">
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </ThemeProvider>
    ),
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```jsx filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import React from 'react';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { ThemeProvider } from 'styled-components';

export default definePreview({
  decorators: [
    (Story) => (
      <ThemeProvider theme="default">
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </ThemeProvider>
    ),
  ],
});
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import vuetify from '../src/plugins/vuetify';

import StoryWrapper from './StoryWrapper.vue';

// Registers the Vuetify plugin in Storybook's Vue app instance
export default definePreview({
  decorators: [
    (_, { globals }) => {
      // The theme can be accessed via the story context's globals
      const themeName = globals.theme || 'light';
      return {
        components: { StoryWrapper },
        setup() {
          return { themeName };
        },
        template: `
          <StoryWrapper :themeName="themeName">
            <template #story>
              <story />
            </template>
          </StoryWrapper>
        `,
      };
    },
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import vuetify from '../src/plugins/vuetify';

import StoryWrapper from './StoryWrapper.vue';

// Registers the Vuetify plugin in Storybook's Vue app instance
export default definePreview({
  decorators: [
    (_, { globals }) => {
      // The theme can be accessed via the story context's globals
      const themeName = globals.theme || 'light';
      return {
        components: { StoryWrapper },
        setup() {
          return { themeName };
        },
        template: `
          <StoryWrapper :themeName="themeName">
            <template #story>
              <story />
            </template>
          </StoryWrapper>
        `,
      };
    },
  ],
});
```
