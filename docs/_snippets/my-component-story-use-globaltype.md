```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<MyComponent>;

const getCaptionForLocale = (locale) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'fr':
      return 'Bonjour!';
    case 'kr':
      return '안녕하세요!';
    case 'zh':
      return '你好!';
    default:
      return 'Hello!';
  }
};

export const StoryWithLocale: Story = {
  render: (args, { globals: { locale } }) => {
    const caption = getCaptionForLocale(locale);
    return {
      template: `<p>${caption}</p>`,
    };
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

const getCaptionForLocale = (locale) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'fr':
      return 'Bonjour!';
    case 'kr':
      return '안녕하세요!';
    case 'zh':
      return '你好!';
    default:
      return 'Hello!';
  }
};

export const StoryWithLocale = {
  render: (args, { globals: { locale } }) => {
    const caption = getCaptionForLocale(locale);
    return <p>{caption}</p>;
  },
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

const getCaptionForLocale = (locale) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'fr':
      return 'Bonjour!';
    case 'kr':
      return '안녕하세요!';
    case 'zh':
      return '你好!';
    default:
      return 'Hello!';
  }
};

export const StoryWithLocale = {
  render: (args, { globals: { locale } }) => {
    const caption = getCaptionForLocale(locale);
    return <p>{caption}</p>;
  },
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

const getCaptionForLocale = (locale) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'fr':
      return 'Bonjour!';
    case 'kr':
      return '안녕하세요!';
    case 'zh':
      return '你好!';
    default:
      return 'Hello!';
  }
};

export const StoryWithLocale = {
  render: (args, { globals: { locale } }) => {
    const caption = getCaptionForLocale(locale);
    return <p>{caption}</p>;
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="solid" language="js"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

const getCaptionForLocale = (locale) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'fr':
      return 'Bonjour!';
    case 'kr':
      return '안녕하세요!';
    case 'zh':
      return '你好!';
    default:
      return 'Hello!';
  }
};

export const StoryWithLocale = {
  render: (args, { globals: { locale } }) => {
    const caption = getCaptionForLocale(locale);
    return <p>{caption}</p>;
  },
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

const getCaptionForLocale = (locale) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'fr':
      return 'Bonjour!';
    case 'kr':
      return '안녕하세요!';
    case 'zh':
      return '你好!';
    default:
      return 'Hello!';
  }
};

export const StoryWithLocale = {
  render: (args, { globals: { locale } }) => {
    const caption = getCaptionForLocale(locale);
    return <p>{caption}</p>;
  },
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

const getCaptionForLocale = (locale) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'fr':
      return 'Bonjour!';
    case 'kr':
      return '안녕하세요!';
    case 'zh':
      return '你好!';
    default:
      return 'Hello!';
  }
};

export const StoryWithLocale = {
  render: (args, { globals: { locale } }) => {
    const caption = getCaptionForLocale(locale);
    return <p>{caption}</p>;
  },
};
```

```js filename="MyComponent.stories.js" renderer="svelte" language="js"
import MyComponent from './MyComponent.svelte';

export default {
  component: MyComponent,
};

const getCaptionForLocale = (locale) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'fr':
      return 'Bonjour!';
    case 'kr':
      return '안녕하세요!';
    case 'zh':
      return '你好!';
    default:
      return 'Hello!';
  }
};

export const StoryWithLocale = {
  render: (args, { globals: { locale } }) => {
    const caption = getCaptionForLocale(locale);
    return {
      Component: MyComponent,
      props: {
        locale: caption,
      },
    };
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/svelte';

import MyComponent from './YourComponent.svelte';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

const getCaptionForLocale = (locale) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'fr':
      return 'Bonjour!';
    case 'kr':
      return '안녕하세요!';
    case 'zh':
      return '你好!';
    default:
      return 'Hello!';
  }
};

export const StoryWithLocale: Story = {
  render: (args, { globals: { locale } }) => {
    const caption = getCaptionForLocale(locale);
    return {
      Component: MyComponent,
      props: {
        locale: caption,
      },
    };
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts"
import type { Meta, StoryObj } from '@storybook/svelte';

import MyComponent from './YourComponent.svelte';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof meta>;

const getCaptionForLocale = (locale) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'fr':
      return 'Bonjour!';
    case 'kr':
      return '안녕하세요!';
    case 'zh':
      return '你好!';
    default:
      return 'Hello!';
  }
};

export const StoryWithLocale: Story = {
  render: (args, { globals: { locale } }) => {
    const caption = getCaptionForLocale(locale);
    return {
      Component: MyComponent,
      props: {
        locale: caption,
      },
    };
  },
};
```

```js filename="MyComponent.stories.js" renderer="vue" language="js"
import MyComponent from './MyComponent.vue';

export default {
  component: MyComponent,
};

const getCaptionForLocale = (locale) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'fr':
      return 'Bonjour!';
    case 'kr':
      return '안녕하세요!';
    case 'zh':
      return '你好!';
    default:
      return 'Hello!';
  }
};

export const StoryWithLocale = {
  render: (args, { globals: { locale } }) => {
    const caption = getCaptionForLocale(locale);
    return {
      template: `<p>${caption}</p>`,
    };
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue3';

import MyComponent from './MyComponent.vue';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

const getCaptionForLocale = (locale) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'fr':
      return 'Bonjour!';
    case 'kr':
      return '안녕하세요!';
    case 'zh':
      return '你好!';
    default:
      return 'Hello!';
  }
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const MyStory: Story = {
  render: (args, { globals: { locale } }) => {
    const caption = getCaptionForLocale(locale);
    return {
      template: `<p>${caption}</p>`,
    };
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3';

import MyComponent from './MyComponent.vue';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

const getCaptionForLocale = (locale) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'fr':
      return 'Bonjour!';
    case 'kr':
      return '안녕하세요!';
    case 'zh':
      return '你好!';
    default:
      return 'Hello!';
  }
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const MyStory: Story = {
  render: (args, { globals: { locale } }) => {
    const caption = getCaptionForLocale(locale);
    return {
      template: `<p>${caption}</p>`,
    };
  },
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  component: 'my-component',
};

const getCaptionForLocale = (locale) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'fr':
      return 'Bonjour!';
    case 'kr':
      return '안녕하세요!';
    case 'zh':
      return '你好!';
    default:
      return 'Hello!';
  }
};

export const StoryWithLocale = {
  render: (args, { globals: { locale } }) => {
    const caption = getCaptionForLocale(locale);
    return html`<p>${caption}</p>`;
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

import { html } from 'lit';

const meta: Meta = {
  component: 'my-component',
};

const getCaptionForLocale = (locale) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'fr':
      return 'Bonjour!';
    case 'kr':
      return '안녕하세요!';
    case 'zh':
      return '你好!';
    default:
      return 'Hello!';
  }
};

export default meta;
type Story = StoryObj;

export const StoryWithLocale: Story = {
  render: (args, { globals: { locale } }) => {
    const caption = getCaptionForLocale(locale);
    return html`<p>${caption}</p>`;
  },
};
```
