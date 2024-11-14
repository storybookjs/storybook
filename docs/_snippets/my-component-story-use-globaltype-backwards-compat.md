```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
export const StoryWithLocale = ({ globals: { locale } }) => {
  const caption = getCaptionForLocale(locale);
  return {
    template: `<p>${caption}</p>`,
  };
};
```

```js filename="MyComponent.stories.js|jsx|mjs|ts|tsx" renderer="react" language="js"
export const StoryWithLocale = ({ globals: { locale } }) => {
  const caption = getCaptionForLocale(locale);
  return <p>{caption}</p>;
};
```

```js filename="MyComponent.stories.js|jsx" renderer="solid" language="js"
export const StoryWithLocale = ({ globals: { locale } }) => {
  const caption = getCaptionForLocale(locale);
  return <p>{caption}</p>;
};
```

```js filename="MyComponent.stories.js" renderer="svelte" language="js"
export const StoryWithLocale = ({ globals: { locale } }) => {
  const caption = getCaptionForLocale(locale);
  return {
    Component: MyComponent,
    props: {
      locale: caption,
    },
  };
};
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts-4-9"
export const StoryWithLocale: Story = ({ globals: { locale } }) => {
  const caption = getCaptionForLocale(locale);
  return {
    Component: MyComponent,
    props: {
      locale: caption,
    },
  };
};
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts"
export const StoryWithLocale: Story = ({ globals: { locale } }) => {
  const caption = getCaptionForLocale(locale);
  return {
    Component: MyComponent,
    props: {
      locale: caption,
    },
  };
};
```

```js filename="MyComponent.stories.js" renderer="vue" language="js"
export const StoryWithLocale = ({ globals: { locale } }) => {
  const caption = getCaptionForLocale(locale);
  return {
    template: `<p>${caption}</p>`,
  };
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const StoryWithLocale = {
  render: ({ globals: { locale } }) => {
    const caption = getCaptionForLocale(locale);
    return html`<p>${caption}</p>`;
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import { html } from 'lit';

import { StoryObj } from '@storybook/web-components';

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const StoryWithLocale: StoryObj = {
  render: ({ globals: { locale } }) => {
    const caption = getCaptionForLocale(locale);
    return html`<p>${caption}</p>`;
  },
};
```
