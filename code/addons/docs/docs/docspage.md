<center>
  <img src="https://raw.githubusercontent.com/storybookjs/storybook/master/addons/docs/docs/media/docspage-hero.png" width="100%" />
</center>

<h1>Storybook DocsPage</h1>

When you install [Storybook Docs](../README.md), `DocsPage` is the zero-config default documentation that all stories get out of the box. It aggregates your stories, text descriptions, docgen comments, props tables, and code examples into a single page for each component.

- [Motivation](#motivation)
- [Component parameter](#component-parameter)
- [Replacing DocsPage](#replacing-docspage)
  - [Remixing DocsPage using doc blocks](#remixing-docspage-using-doc-blocks)
- [Story file names](#story-file-names)
- [Inline stories vs. Iframe stories](#inline-stories-vs-iframe-stories)
- [Show/Hide code](#showhide-code)
- [More resources](#more-resources)

## Motivation

`DocsPage` is the successor to [`addon-info`](https://github.com/storybookjs/deprecated-addons/tree/master/addons/info), which was one of the most popular Storybook addons despite many limitations.

Like `addon-info`, `DocsPage` provides sensible defaults, meaning it adds documentation to your existing Storybook without requiring any additional work on your part.

However, `DocsPage` brings the following improvements:

- It supports all frameworks that Storybook supports, including React, Vue 3, Angular and [many others](../README.md#framework-support).
- It generates better documentation that can be used as a standalone docs site, independently of Storybook.
- It supports better configuration, so you can capture project specific information with ease.
- It's built to work with [`MDX`](./mdx.md) when you need more control of your documentation.

## Component parameter

`DocsPage` pulls info from many sources, but one of the main ones is the `component` parameter, which is a new addition to Storybook in 5.2. It's based on the best practice that each component should have an associated set of documentation and stories (versus organizing it in some other way).

Storybook uses `component` to extract the component's description and props, and will rely on it further in future releases. We encourage you to add it to existing stories and use it in all new stories.

Here's how to set the component in [Component Story Format (CSF)](https://storybook.js.org/docs/api/csf):

```js
import { Badge } from './Badge';

export default {
  title: 'Path/to/Badge',
  component: Badge,
};
```

And here's how to do the same thing the underlying `storiesOf` API:

```js
import { storiesOf } from '@storybook/react';
import { Badge } from './Badge';

storiesOf('Path/to/Badge', module).addParameters({ component: Badge });
```

If you're coming from the `storiesOf` format, there's [a codemod that adds it for you](https://github.com/storybookjs/storybook/blob/next/code/lib/codemod/README.md#add-component-parameters).

## Replacing DocsPage

What if you don't want a `DocsPage` for your Storybook, for a specific component, or even for a specific story?

You can replace DocsPage at any level by overriding the `docs.page` parameter:

- With `null` to remove docs
- [With MDX](./recipes.md#csf-stories-with-mdx-docs) docs
- With a custom React component

**Globally (preview.js)**

```js
import { addParameters } from '@storybook/react';

addParameters({ docs: { page: null } });
```

**Component-level (Button.stories.js)**

```js
import { Button } from './Button';

export default {
  title: 'Demo/Button',
  component: Button,
  parameters: { docs: { page: null } },
};
```

**Story-level (Button.stories.js)**

```js
import { Button } from './Button';
// export default { ... }
export const basic => () => <Button>Basic</Button>
basic.parameters = {
  docs: { page: null }
}
```

### Remixing DocsPage using doc blocks

Here's an example of rebuilding `DocsPage` out of doc blocks:

```js
import React from 'react';
import { ArgsTable, Description, Primary, Stories, Subtitle, Title } from '@storybook/addon-docs';
import { DocgenButton } from '../../components/DocgenButton';

export default {
  title: 'Addons/Docs/stories docs blocks',
  component: DocgenButton,
  parameters: {
    docs: {
      page: () => (
        <>
          <Title />
          <Subtitle />
          <Description />
          <Primary />
          <ArgsTable />
          <Stories />
        </>
      ),
    },
  },
};
```

You can interleave your own components to customize the auto-generated contents of the page, or pass in different options to the blocks to customize their appearance.

## Story file names

Unless you use a custom webpack configuration, all of your story files should have the suffix `*.stories.@(j|t)sx?`, e.g. `"Badge.stories.js"`, `"Badge.stories.tsx"`, etc.

The docs preset assumes this naming convention for its `source-loader` setup. If you want to use a different naming convention, you'll need a [manual configuration](../README.md#manual-configuration).

## Inline stories vs. Iframe stories

Due to the complex nature of writing a cross-framework utility like Storybook, the story blocks for most frameworks exist within an `<iframe>` element. This creates a clean separation of the context the code for each framework lives inside, but it isn't a perfect tradeoff. It does create a set of disadvantages--namely, you have to explicitly set the height of a story. It also causes some headaches for certain dev tools (Vue dev tools, for example, don't pick up components that exist in an iframe, without substantial jerry-rigging).

That being said, there is a system in place to remove the necessity of this tradeoff. The docs configuration contains two options, `inlineStories` and `prepareForInline` that can work together to integrate non-react stories seamlessly (or should I say "scroll-bar-less-ly") into DocsPage. Setting `inlineStories` to `true` tells storybook to stop putting your stories into an iframe. The hard(er) part is providing the `prepareForInline` parameter. This parameter accepts a function that transforms story content in your given framework into something react can render. Any given framework will need to approach this in a different way. Angular, for example, might convert its story content into a custom element (you can read about that [here](https://angular.io/guide/elements)). We've actually taken the initiative and implemented Vue inline stories _for you_ in the default docs config for Vue, because we're such nice people. The following docs config block allows Vue components to be rendered inline through an effect hook provided by [@egoist/vue-to-react](https://github.com/egoist/vue-to-react):

```js
import React from 'react';
import { render } from 'react-dom';
import { addParameters } from '@storybook/vue';
import toReact from '@egoist/vue-to-react';

addParameters({
  docs: {
    prepareForInline: (storyFn, { args }) => {
      const Story = toReact(storyFn());
      return <Story {...args} />;
    },
  },
});
```

With that function, anyone using the docs addon for `@storybook/vue` can make their stories render inline, either globally with the `docs.story.inline` parameter, or on a per-story-basis using the `inline` prop on the `<Story>` doc block. If you come up with an elegant and flexible implementation for the `prepareForInline` function for your own framework, let us know! We'd love to make it the default configuration, to make inline stories more accessible for a larger variety of frameworks!

## Show/Hide code

By default, the code block under the Preview is collapsed and you have to click on "Show code" to reveal it.

You can override this default behavior in `.storybook/preview.js` (or in any of your components/stories):

```js
export const parameters = {
  docs: {
    canvas: {
      sourceState: 'shown',
    },
  },
};
```

With that flag, now the docs addon will show all code blocks open by default.

## More resources

- References: [README](../README.md) / [DocsPage](docspage.md) / [MDX](mdx.md) / [FAQ](faq.md) / [Recipes](recipes.md) / [Theming](theming.md) / [Props](props-tables.md)
- Framework-specific docs: [React](../react/README.md) / [Vue](../vue/README.md) / [Angular](../angular/README.md) / [Web components](../web-components/README.md) / [Ember](../ember/README.md)
- Announcements: [Vision](https://medium.com/storybookjs/storybook-docs-sneak-peak-5be78445094a) / [DocsPage](https://medium.com/storybookjs/storybook-docspage-e185bc3622bf) / [MDX](https://medium.com/storybookjs/rich-docs-with-storybook-mdx-61bc145ae7bc) / [Framework support](https://medium.com/storybookjs/storybook-docs-for-new-frameworks-b1f6090ee0ea)
- Example: [Storybook Design System](https://github.com/storybookjs/design-system)
