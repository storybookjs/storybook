<h1>Storybook Docs framework dev guide</h1>

Storybook Docs [provides basic support for all non-RN Storybook view layers](../README.md#framework-support) out of the box. However, some frameworks have been docs-optimized, adding features like automatic props table generation and inline story rendering. This document is a dev guide for how to optimize a new framework in docs.

- [Framework-specific configuration](#framework-specific-configuration)
- [Arg tables](#arg-tables)
- [Component descriptions](#component-descriptions)
- [Inline story rendering](#inline-story-rendering)
- [Dynamic source rendering](#dynamic-source-rendering)
- [More resources](#more-resources)

## Framework-specific configuration

Your framework might need framework-specific configuration. This could include adding extra webpack loaders or global decorators/story parameters.

Addon-docs handles this kind of customization by file naming convention. Its [common preset](https://github.com/storybookjs/storybook/blob/next/addons/docs/src/frameworks/common/preset.ts) does this by looking for files `../<framework>/{preset,config}.[tj]sx?`, where `<framework>` is the framework identifier, e.g. `vue3`, `angular`, `react`, etc.

For example, consider Storybook Docs for Vue, which needs `vue-docgen-loader` in its webpack config, and also has custom extraction functions for [props tables](#props-tables) and [component descriptions](#component-descriptions).

For webpack configuration, Docs for Vue defines [preset.ts](https://github.com/storybookjs/storybook/blob/next/addons/docs/src/frameworks/vue/preset.ts), which follows the [preset](https://storybook.js.org/docs/vue/api/presets) file structure:

```
export function webpack(webpackConfig: any = {}, options: any = {}) {
  webpackConfig.module.rules.push({
    test: /\.vue$/,
    loader: 'vue-docgen-loader',
    enforce: 'post',
  });
  return webpackConfig;
}
```

This appends `vue-docgen-loader` to the existing configuration, which at this point will also include modifications made by the common preset.

For props tables and descriptions, both of which are described in more detail below, it defines a file [config.jsx](https://github.com/storybookjs/storybook/blob/next/addons/docs/src/frameworks/vue/config.jsx).

## Arg tables

Each framework can auto-generate ArgTables by exporting one or more `ArgType` enhancers, which extracts a component's properties into a common data structure.

Here's how it's done in Vue's framework-specific `preview.js`:

```js
import { enhanceArgTypes } from './enhanceArgTypes';

export const argTypesEnhancers = [enhanceArgTypes];
```

The `enhanceArgTypes`function takes a `StoryContext` (including the story id, parameters, args, argTypes, etc.), and returns an updated [`ArgTypes` object](https://github.com/storybookjs/storybook/blob/master/lib/addons/src/types.ts#L38-L47):

```ts
export interface ArgType {
  name?: string;
  description?: string;
  defaultValue?: any;
  [key: string]: any;
}

export interface ArgTypes {
  [key: string]: ArgType;
}
```

For more information on what this generation looks like, see the [controls generation docs](https://github.com/storybookjs/storybook/blob/next/addons/controls/README.md#my-controls-arent-being-auto-generated-what-should-i-do).

For React and Vue, the extraction works as follows:

- A webpack loader is added to the user's config via the preset
- The loader annotates the component with a field, `__docgenInfo`, which contains some metadata
- The view-layer specific `enhanceArgTypes` function translates that metadata into `ArgTypes`

For Angular, Web components, and Ember, the extraction works as follows:

- Read JSON file in the user's `.storybook/preview.json` and story it into a global variable
- The view-layer specific `enhanceArgTypes` function translates that metadata into `ArgTypes`

However, for your framework you may want to implement this in some other way.

## Component descriptions

Component descriptions are enabled by the `docs.extractComponentDescription` parameter, which extract's a component description (usually from source code comments) into a markdown string.

It follows the pattern of [Arg tables](#arg-tables) above, only it's even simpler because the function output is simply a string (or null if there no description).

## Inline story rendering

Inline story rendering is another framework specific optimization, made possible by the `docs.prepareForInline` parameter.

Again let's look at Vue's framework-specific `preview.js`:

```js
import toReact from '@egoist/vue-to-react';

addParameters({
  docs: {
    // `container`, `page`, etc. here
    prepareForInline: (storyFn, { args }) => {
      const Story = toReact(storyFn());
      return <Story {...args} />;
    },
  },
});
```

The input is the story function and the story context (id, parameters, args, etc.), and the output is a React element, because we render docs pages in react. In the case of Vue, all of the work is done by the `@egoist/vue-to-react` library. If there's no analogous library for your framework, you may need to figure it out yourself!

## Dynamic source rendering

With the release of Storybook 6.0, we've improved how stories are rendered in the [`Source` doc block](https://storybook.js.org/docs/react/api/doc-block-source). One of such improvements is the `dynamic` source type, which renders a snippet based on the output the story function.

This dynamic rendering is framework-specific, meaning it needs a custom implementation for each framework.

Let's take a look at the React framework implementation of `dynamic` snippets as a reference for implementing this feature in other frameworks:

```tsx
import { StoryContext, addons } from '@storybook/preview-api';
import { SNIPPET_RENDERED } from '../../shared';

export const jsxDecorator = (storyFn: any, context: StoryContext) => {
  const story = storyFn();

  // We only need to render JSX if the source block is actually going to
  // consume it. Otherwise it's just slowing us down.
  if (skipJsxRender(context)) {
    return story;
  }

  const channel = addons.getChannel();

  const options = {}; // retrieve from story parameters
  const jsx = renderJsx(story, options);

  const { id, args } = context;
  channel.emit(SNIPPET_RENDERED, { id, args, source: jsx });

  return story;
};
```

A few key points from the above snippet:

- The **renderJsx** function call is responsible for transforming the output of a story function into a string specific to the framework (in this case React).
- The returned snippet string is emitted on Storybook's channel through **channel.emit()** and subsequently consumed up by the Source block for any given story, if it exists.

<div class="aside">
 To learn more and see how it's implemented in context, check out <a href="https://github.com/storybookjs/storybook/blob/next/addons/docs/src/frameworks/react/jsxDecorator.tsx">the code</a> .
</div>

Now we need a way to configure how it's displayed in the UI:

```tsx
import { jsxDecorator } from './jsxDecorator';

export const decorators = [jsxDecorator];
```

This configures the `jsxDecorator` to be run on every story.

<div class="aside">
 To learn more and see how it's implemented in context, check out <a href="https://github.com/storybookjs/storybook/blob/next/addons/docs/src/frameworks/react/jsxDecorator.tsx">the code</a> .
</div>

## More resources

- References: [README](../README.md) / [DocsPage](docspage.md) / [MDX](mdx.md) / [FAQ](faq.md) / [Recipes](recipes.md) / [Theming](theming.md) / [Props](props-tables.md)
- Framework-specific docs: [React](../react/README.md) / [Vue 3](../vue3/README.md) / [Angular](../angular/README.md) / [Web components](../web-components/README.md) / [Ember](../ember/README.md)
- Announcements: [Vision](https://medium.com/storybookjs/storybook-docs-sneak-peak-5be78445094a) / [DocsPage](https://medium.com/storybookjs/storybook-docspage-e185bc3622bf) / [MDX](https://medium.com/storybookjs/rich-docs-with-storybook-mdx-61bc145ae7bc) / [Framework support](https://medium.com/storybookjs/storybook-docs-for-new-frameworks-b1f6090ee0ea)
- Example: [Storybook Design System](https://github.com/storybookjs/design-system)
