<center>
  <img src="../docs/media/docspage-hero.png" width="100%" />
</center>

<h1>Storybook Docs for React</h1>

> migration guide: This page documents the method to configure storybook introduced recently in 5.3.0, consult the [migration guide](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md) if you want to migrate to this format of configuring storybook.

Storybook Docs transforms your Storybook stories into world-class component documentation. Storybook Docs for React supports [DocsPage](../docs/docspage.md) for auto-generated docs, and [MDX](../docs/mdx.md) for rich long-form docs.

To learn more about Storybook Docs, read the [general documentation](../README.md). To learn the React specifics, read on!

- [Installation](#installation)
- [DocsPage](#docspage)
- [Props tables](#props-tables)
- [MDX](#mdx)
- [Inline stories](#inline-stories)
- [TypeScript props with `react-docgen-typescript`](#typescript-props-with-react-docgen-typescript)
- [More resources](#more-resources)

## Installation

First add the package. Make sure that the versions for your `@storybook/*` packages match:

```sh
yarn add -D @storybook/addon-docs
```

Then add the following to your `.storybook/main.js` list of `addons`:

```js
export default {
  // other settings
  addons: ['@storybook/addon-docs'];
}
```

## DocsPage

When you [install docs](#installation) you should get basic [DocsPage](../docs/docspage.md) documentation automagically for all your stories, available in the `Docs` tab of the Storybook UI.

## Props tables

Storybook Docs automatically generates [Props tables](../docs/props-tables.md) for your components based on either `PropTypes` or `TypeScript` types. To show the props table for your component, be sure to fill in the `component` field in your story metadata:

```ts
import { Button } from './Button';

export default {
  title: 'Button',
  component: Button,
};
```

If you haven't upgraded from `storiesOf`, you can use a parameter to do the same thing:

```ts
import { storiesOf } from '@storybook/react';
import { Button } from './Button';

storiesOf('InfoButton', module)
  .addParameters({ component: Button })
  .add( ... );
```

## MDX

[MDX](../docs/mdx.md) is a convenient way to document your components in Markdown and embed documentation components, such as stories and props tables, inline.

Then update your `.storybook/main.js` to make sure you load MDX files:

```js
export default {
  stories: ['../src/stories/**/*.stories.@(js|mdx)'],
};
```

Finally, you can create MDX files like this:

```md
import { Meta, Story, ArgsTable } from '@storybook/addon-docs';
import { Button } from './Button';

<Meta title='Button' component={Button} />

# Button

Some **markdown** description, or whatever you want.

<Story name='basic' height='400px'>
  <Button>Label</Button>
</Story>

## ArgsTable

<ArgsTable of={Button} />
```

## Inline stories

Storybook Docs renders all React stories inline by default.

However, you can render stories in an iframe, with a default height of `60px` (configurable using the `docs.story.iframeHeight` story parameter), by using the `docs.stories.inline` parameter.

To do so for all stories, update `.storybook/preview.js`:

```js
export const parameters = { docs: { story: { inline: false } } };
```

## TypeScript props with `react-docgen-typescript`

If you're using TypeScript, there are two different options for generating props: `react-docgen` (default) or `react-docgen-typescript`.

You can add the following lines to your `.storybook/main.js` to switch between the two (or disable docgen):

```js
export default {
  typescript: {
    // also valid 'react-docgen' | false
    reactDocgen: 'react-docgen-typescript',
  },
};
```

Neither option is perfect, so here's everything you should know if you're thinking about using `react-docgen` for TypeScript.

|                 | `react-docgen-typescript`                                                                                                 | `react-docgen`                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Features**    | **Great**. The analysis produces great results which gives the best props table experience.                               | **OK**. React-docgen produces basic results that are fine for most use cases.                         |
| **Performance** | **Slow**. It's doing a lot more work to produce those results, and may also have an inefficient implementation.           | **Blazing fast**. Adding it to your project increases build time negligibly.                          |
| **Bugs**        | **Some**. There are corner cases that are not handled properly, and are annoying for developers.                          | **Some**. There are corner cases that are not handled properly, and are annoying for developers.      |
| **SB docs**     | **Good**. Our prop tables have supported `react-docgen-typescript` results from the beginning, so it's relatively stable. | **OK**. There are some obvious improvements to fully support `react-docgen`, and they're coming soon. |

**Performance** is a common question, so here are build times from a random project to quantify. Your mileage may vary:

| Docgen                  | Build time |
| ----------------------- | ---------- |
| react-docgen-typescript | 33s        |
| react-docgen            | 29s        |
| none                    | 28s        |

## More resources

Want to learn more? Here are some more articles on Storybook Docs:

- References: [DocsPage](../docs/docspage.md) / [MDX](../docs/mdx.md) / [FAQ](../docs/faq.md) / [Recipes](../docs/recipes.md) / [Theming](../docs/theming.md) / [Props](../docs/props-tables.md)
- Announcements: [Vision](https://medium.com/storybookjs/storybook-docs-sneak-peak-5be78445094a) / [DocsPage](https://medium.com/storybookjs/storybook-docspage-e185bc3622bf) / [MDX](https://medium.com/storybookjs/rich-docs-with-storybook-mdx-61bc145ae7bc) / [Framework support](https://medium.com/storybookjs/storybook-docs-for-new-frameworks-b1f6090ee0ea)
- Example: [Storybook Design System](https://github.com/storybookjs/design-system)
