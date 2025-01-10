<center>
  <img src="../docs/media/vue-hero.png" width="100%" />
</center>

<h1>Storybook Docs for Vue</h1>

> migration guide: This page documents the method to configure storybook introduced recently in 5.3.0, consult the [migration guide](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md) if you want to migrate to this format of configuring storybook.

Storybook Docs transforms your Storybook stories into world-class component documentation. Storybook Docs for Vue supports [DocsPage](../docs/docspage.md) for auto-generated docs, and [MDX](../docs/mdx.md) for rich long-form docs.

To learn more about Storybook Docs, read the [general documentation](../README.md). To learn the Vue specifics, read on!

- [Installation](#installation)
- [Preset options](#preset-options)
- [DocsPage](#docspage)
- [Props tables](#props-tables)
- [MDX](#mdx)
- [Inline Stories](#inline-stories)
- [More resources](#more-resources)

## Installation

First add the package. Make sure that the versions for your `@storybook/*` packages match:

```sh
yarn add -D @storybook/addon-docs
```

Then add the following to your `.storybook/main.js` addons:

```js
export default {
  addons: ['@storybook/addon-docs'],
};
```

## Preset options

The `addon-docs` preset for Vue has a configuration option that can be used to configure [`vue-docgen-api`](https://github.com/vue-styleguidist/vue-styleguidist/tree/dev/packages/vue-docgen-api), a tool which extracts information from Vue components. Here's an example of how to use the preset with options for Vue app:

```js
import * as path from 'path';

export default {
  addons: [
    {
      name: '@storybook/addon-docs',
      options: {
        vueDocgenOptions: {
          alias: {
            '@': path.resolve(__dirname, '../'),
          },
        },
      },
    },
  ],
};
```

The `vueDocgenOptions` is an object for configuring `vue-docgen-api`. See [`vue-docgen-api`'s docs](https://github.com/vue-styleguidist/vue-styleguidist/tree/dev/packages/vue-docgen-api#options-docgenoptions) for available configuration options.

## DocsPage

When you [install docs](#installation) you should get basic [DocsPage](../docs/docspage.md) documentation automagically for all your stories, available in the `Docs` tab of the Storybook UI.

## Props tables

Getting [Props tables](../docs/props-tables.md) for your components requires a few more steps. Docs for Vue relies on [`vue-docgen-loader`](https://github.com/pocka/vue-docgen-loader). It supports `props`, `events`, and `slots` as first class prop types.

Finally, be sure to fill in the `component` field in your story metadata:

```ts
import { InfoButton } from './InfoButton.vue';

export default {
  title: 'InfoButton',
  component: InfoButton,
};
```

If you haven't upgraded from `storiesOf`, you can use a parameter to do the same thing:

```ts
import { storiesOf } from '@storybook/vue';
import { InfoButton } from './InfoButton.vue';

storiesOf('InfoButton', module)
  .addParameters({ component: InfoButton })
  .add( ... );
```

## MDX

[MDX](../docs/mdx.md) is a convenient way to document your components in Markdown and embed documentation components, such as stories and props tables, inline.

Docs has peer dependencies on `react`. If you want to write stories in MDX, you may need to add this dependency as well:

```sh
yarn add -D react
```

Then update your `.storybook/main.js` to make sure you load MDX files:

```js
export default {
  stories: ['../src/stories/**/*.stories.@(js|mdx)'],
};
```

Finally, you can create MDX files like this:

```md
import { Meta, Story, ArgsTable } from '@storybook/addon-docs';
import { InfoButton } from './InfoButton.vue';

<Meta title='InfoButton' component={InfoButton} />

# InfoButton

Some **markdown** description, or whatever you want.

<Story name='basic' height='400px'>{{
  components: { InfoButton },
  template: '<info-button label="I\'m a button!"/>',
}}</Story>

## ArgsTable

<ArgsTable of={InfoButton} />
```

Yes, it's redundant to declare `component` twice. [Coming soon](https://github.com/storybookjs/storybook/issues/8685).

## Inline Stories

Storybook Docs renders all Vue stories inline by default.

However, you can render stories in an iframe, with a default height of `60px` (configurable using the `docs.story.iframeHeight` story parameter), by using the `docs.stories.inline` parameter.

To do so for all stories, update `.storybook/preview.js`:

```js
export const parameters = { docs: { story: { inline: false } } };
```

## More resources

Want to learn more? Here are some more articles on Storybook Docs:

- References: [DocsPage](../docs/docspage.md) / [MDX](../docs/mdx.md) / [FAQ](../docs/faq.md) / [Recipes](../docs/recipes.md) / [Theming](../docs/theming.md) / [Props](../docs/props-tables.md)
- Announcements: [Vision](https://medium.com/storybookjs/storybook-docs-sneak-peak-5be78445094a) / [DocsPage](https://medium.com/storybookjs/storybook-docspage-e185bc3622bf) / [MDX](https://medium.com/storybookjs/rich-docs-with-storybook-mdx-61bc145ae7bc) / [Framework support](https://medium.com/storybookjs/storybook-docs-for-new-frameworks-b1f6090ee0ea)
- Example: [Storybook Design System](https://github.com/storybookjs/design-system)
