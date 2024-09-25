<center>
  <img src="https://raw.githubusercontent.com/storybookjs/storybook/master/addons/docs/docs/media/mdx-hero.png" width="100%" />
</center>

<h1>Storybook Docs MDX</h1>

`MDX` is the syntax [Storybook Docs](../README.md) uses to capture long-form markdown documentation and stories in one file. You can also write pure documentation pages in `MDX` and add them to Storybook alongside your stories.

- [Basic example](#basic-example)
- [MDX-Flavored CSF](#mdx-flavored-csf)
- [Writing stories](#writing-stories)
- [Embedding stories](#embedding-stories)
- [Decorators and parameters](#decorators-and-parameters)
- [Documentation-only MDX](#documentation-only-mdx)
- [MDX file names](#mdx-file-names)
- [More resources](#more-resources)

## Basic example

Let's get started with an example that combines markdown with a single story:

```md
import { Meta, Story, Canvas } from '@storybook/addon-docs';
import { Checkbox } from './Checkbox';

<Meta title="MDX/Checkbox" component={Checkbox} />

# Checkbox

With `MDX` we can define a story for `Checkbox` right in the middle of our
markdown documentation.

<Canvas>
  <Story name="all checkboxes">
    <form>
      <Checkbox id="Unchecked" label="Unchecked" />
      <Checkbox id="Checked" label="Checked" checked />
      <Checkbox appearance="secondary" id="second" label="Secondary" checked />
    </form>
  </Story>
</Canvas>
```

And here's how that's rendered in Storybook:

<center>
  <img src="https://raw.githubusercontent.com/storybookjs/storybook/master/addons/docs/docs/media/mdx-simple.png" width="100%" />
</center>

As you can see there's a lot going on here. We're writing Markdown, we're writing JSX, and somehow we're also defining Storybook stories that are drop-in compatible with the entire Storybook ecosystem.

Let's break it down.

## MDX-Flavored CSF

[MDX](https://mdxjs.com/) is a standard file format that combines Markdown with JSX. This means you can use Markdown’s terse syntax (such as `# heading`) for your documentation, and freely embed JSX component blocks at any point in the file.

MDX-flavored [Component Story Format (CSF)](https://medium.com/storybookjs/component-story-format-66f4c32366df) includes a collection of components called **"Doc Blocks"**, that allow Storybook to translate MDX files into storybook stories. MDX-defined stories are identical to regular Storybook stories, so they can be used with Storybook's entire ecosystem of addons and view layers.

For example, here's the story from `Checkbox` example above, rewritten in CSF:

```js
import React from 'react';
import { Checkbox } from './Checkbox';
export default { title: "MDX/Checkbox" component: Checkbox };
export const allCheckboxes = () => (
  <form>
    <Checkbox id="Unchecked" label="Unchecked" />
    <Checkbox id="Checked" label="Checked" checked />
    <Checkbox appearance="secondary" id="second" label="Secondary" checked />
  </form>
);
```

There's a one-to-one mapping from the code in `MDX` to `CSF`, which in turn directly corresponds to Storybook's internal `storiesOf` API. As a user, this means your existing Storybook knowledge should translate between the three. And technically, this means that the transformations that happen under the hood are simple and predictable.

## Writing stories

Now let's look at a more realistic example to see a few more things we can do:

```md
import { Meta, Story, Canvas } from '@storybook/addon-docs';

import { Badge } from './Badge';
import { Icon } from './Icon';

<Meta title="MDX/Badge" component={Badge} />

# Badge

Let's define a story for our `Badge` component:

<Story name="positive">
  <Badge status="positive">Positive</Badge>
</Story>

We can drop it in a `Canvas` to get a code snippet:

<Canvas>
  <Story name="negative">
    <Badge status="negative">Negative</Badge>
  </Story>
</Canvas>

We can even preview multiple stories in a block. This
gets rendered as a group, but defines individual stories
with unique URLs and isolated snapshot tests.

<Canvas>
  <Story name="warning">
    <Badge status="warning">Warning</Badge>
  </Story>
  <Story name="neutral">
    <Badge status="neutral">Neutral</Badge>
  </Story>
  <Story name="error">
    <Badge status="error">Error</Badge>
  </Story>
  <Story name="with icon">
    <Badge status="warning">
      <Icon icon="check" inline />
      with icon
    </Badge>
  </Story>
</Canvas>
```

And here's how that gets rendered in Storybook:

<center>
  <img src="https://raw.githubusercontent.com/storybookjs/storybook/master/addons/docs/docs/media/mdx-page.png" width="100%" />
</center>

## Embedding stories

Suppose you have an existing story and want to embed it into your docs. Here's how to show a story with ID `some--id` (check the browser URL in Storybook v5+ to see a story's ID):

```md
import { Story } from "@storybook/addon-docs";

# Some header

And markdown here

<Story id="some--id" />
```

You can also use the rest of the MDX features in conjunction with embedding. That includes source, preview, and prop tables.

## Decorators and parameters

To add [decorators](https://storybook.js.org/docs/react/writing-stories/decorators) and [parameters](https://storybook.js.org/docs/react/writing-stories/parameters) in MDX:

```md
<Meta
  title='MyComponent'
  decorators={[ ... ]}
  parameters={{ ... }}
/>

<Story name="story" decorators={[ ... ]} parameters={{ ... }} >
...
</Story>
```

In addition, global decorators work just like before, e.g. adding the following to your `.storybook/preview.js`:

```js
import { addDecorator, addParameters } from '@storybook/react';

addDecorator(...);
addParameters({ ... });
```

## Documentation-only MDX

Typically, when you use Storybook MDX, you define stories in the MDX documentation is automatically associated with those stories. But what if you want to write Markdown-style documentation and have it show up in your Storybook?

If you don't define stories in your MDX, you can write MDX documentation and associate it with an existing story, or embed that MDX as its own documentation node in your Storybook's navigation.

If you don't define a `Meta`, you can write Markdown and associate with an existing story. See ["CSF Stories with MDX Docs"](recipes.md#csf-stories-with-mdx-docs).

To get a "documentation-only story", in your UI, define a `<Meta>` as you normally would, but don't define any stories. It will show up in your UI as a documentation node:

<center>
  <img src="https://raw.githubusercontent.com/storybookjs/storybook/master/addons/docs/docs/media/mdx-documentation-only.png" width="100%" />
</center>

## MDX file names

Unless you use a custom webpack configuration, all of your `MDX` files should have the suffix `*.stories.mdx`. This tells Storybook to apply its special processing to the `<Meta>` and `<Story>` elements in the file.

Be sure to update your Storybook config file to load `.stories.mdx` stories, as per the [`addon-docs` installation instructions](../README.md#installation).

## More resources

- References: [README](../README.md) / [DocsPage](docspage.md) / [MDX](mdx.md) / [FAQ](faq.md) / [Recipes](recipes.md) / [Theming](theming.md) / [Props](props-tables.md)
- Framework-specific docs: [React](../react/README.md) / [Vue 3](../vue3/README.md) / [Angular](../angular/README.md) / [Web components](../web-components/README.md) / [Ember](../ember/README.md)
- Announcements: [Vision](https://medium.com/storybookjs/storybook-docs-sneak-peak-5be78445094a) / [DocsPage](https://medium.com/storybookjs/storybook-docspage-e185bc3622bf) / [MDX](https://medium.com/storybookjs/rich-docs-with-storybook-mdx-61bc145ae7bc) / [Framework support](https://medium.com/storybookjs/storybook-docs-for-new-frameworks-b1f6090ee0ea)
- Example: [Storybook Design System](https://github.com/storybookjs/design-system)
