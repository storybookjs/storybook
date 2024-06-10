---
title: 'Decorators'
---

<YouTubeCallout id="4yi_yCTkgng" title="Storybook Decorators Crash Course" />

A decorator is a way to wrap a story in extra “rendering” functionality. Many addons define decorators to augment your stories with extra rendering or gather details about how your story renders.

When writing stories, decorators are typically used to wrap stories with extra markup or context mocking.

## Wrap stories with extra markup

Some components require a “harness” to render in a useful way. For instance, if a component runs right up to its edges, you might want to space it inside Storybook. Use a decorator to add spacing for all stories of the component.

![Story without padding](./decorators-no-padding.png)

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/your-component-with-decorator.js.mdx',
    'react/your-component-with-decorator.ts.mdx',
    'vue/your-component-with-decorator.js.mdx',
    'vue/your-component-with-decorator.ts.mdx',
    'angular/your-component-with-decorator.ts.mdx',
    'web-components/your-component-with-decorator.js.mdx',
    'web-components/your-component-with-decorator.ts.mdx',
    'svelte/your-component-with-decorator.js.mdx',
    'svelte/your-component-with-decorator.ts.mdx',
    'svelte/margindecorator.with-margin-component.js.mdx',
    'svelte/margindecorator.with-margin-component.ts.mdx',
    'solid/your-component-with-decorator.js.mdx',
    'solid/your-component-with-decorator.ts.mdx'
  ]}
/>

<!-- prettier-ignore-end -->

![Story with padding](./decorators-padding.png)

## “Context” for mocking

The second argument to a decorator function is the **story context** which contains the properties:

- `args` - the story arguments. You can use some [`args`](./args.md) in your decorators and drop them in the story implementation itself.
- `argTypes`- Storybook's [argTypes](../api/arg-types.md) allow you to customize and fine-tune your stories [`args`](./args.md).
- `globals` - Storybook-wide [globals](../essentials/toolbars-and-globals.md#globals). In particular you can use the [toolbars feature](../essentials/toolbars-and-globals.md#global-types-toolbar-annotations) to allow you to change these values using Storybook’s UI.
- `hooks` - Storybook's API hooks (e.g., useArgs).
- `parameters`- the story's static metadata, most commonly used to control Storybook's behavior of features and addons.
- `viewMode`- Storybook's current active window (e.g., canvas, docs).

This context can be used to adjust the behavior of your decorator based on the story's arguments or other metadata. For example, you could create a decorator that allows you to optionally apply a layout to the story, by defining `parameters.pageLayout = 'page'` (or `'page-mobile'`):
:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/decorator-parameterized-in-preview.js.mdx',
    'react/decorator-parameterized-in-preview.ts.mdx',
    'vue/decorator-parameterized-in-preview.js.mdx',
    'vue/decorator-parameterized-in-preview.ts.mdx',
    'angular/decorator-parameterized-in-preview.ts.mdx',
    'solid/decorator-parameterized-in-preview.js.mdx',
    'solid/decorator-parameterized-in-preview.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

<Callout variant="info" icon="💡">

For another example, see the section on [configuring the mock provider](./mocking-providers.md#configuring-the-mock-provider), which demonstrates how to use the same technique to change which theme is provided to the component.

</Callout>

### Using decorators to provide data

If your components are “connected” and require side-loaded data to render, you can use decorators to provide that data in a mocked way without having to refactor your components to take that data as an arg. There are several techniques to achieve this. Depending on exactly how you are loading that data. Read more in the [building pages in Storybook](./build-pages-with-storybook.md) section.

## Story decorators

To define a decorator for a single story, use the `decorators` key on a named export:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/button-story-decorator.js.mdx',
    'react/button-story-decorator.ts.mdx',
    'vue/button-story-decorator.js.mdx',
    'vue/button-story-decorator.ts.mdx',
    'angular/button-story-decorator.ts.mdx',
    'web-components/button-story-decorator.js.mdx',
    'web-components/button-story-decorator.ts.mdx',
    'svelte/button-story-decorator.js.mdx',
    'svelte/button-story-decorator.ts.mdx',
    'svelte/margindecorator.with-margin-component.js.mdx',
    'svelte/margindecorator.with-margin-component.ts.mdx',
    'solid/button-story-decorator.js.mdx',
    'solid/button-story-decorator.ts.mdx',
  ]}
  usesCsf3
  csf2Path="writing-stories/decorators#snippet-button-story-decorator"
/>


<!-- prettier-ignore-end -->

It is useful to ensure that the story remains a “pure” rendering of the component under test and that any extra HTML or components are used only as decorators. In particular the [Source](../api/doc-block-source.md) Doc Block works best when you do this.

## Component decorators

To define a decorator for all stories of a component, use the `decorators` key of the default CSF export:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/button-story-component-decorator.js.mdx',
    'react/button-story-component-decorator.ts.mdx',
    'vue/button-story-component-decorator.js.mdx',
    'vue/button-story-component-decorator.ts.mdx',
    'angular/button-story-component-decorator.ts.mdx',
    'web-components/button-story-component-decorator.js.mdx',
    'web-components/button-story-component-decorator.ts.mdx',
    'svelte/button-story-component-decorator.js.mdx',
    'svelte/button-story-component-decorator.ts.mdx',
    'svelte/margindecorator.with-margin-component.js.mdx',
    'svelte/margindecorator.with-margin-component.ts.mdx',
    'solid/button-story-component-decorator.js.mdx',
    'solid/button-story-component-decorator.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

## Global decorators

We can also set a decorator for **all stories** via the `decorators` export of your [`.storybook/preview.js`](../configure/index.md#configure-story-rendering) file (this is the file where you configure all stories):

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/storybook-preview-global-decorator.js.mdx',
    'react/storybook-preview-global-decorator.ts.mdx',
    'vue/storybook-preview-global-decorator.js.mdx',
    'vue/storybook-preview-global-decorator.ts.mdx',
    'angular/storybook-preview-global-decorator.ts.mdx',
    'web-components/storybook-preview-global-decorator.js.mdx',
    'svelte/storybook-preview-global-decorator.js.mdx',
    'svelte/storybook-preview-global-decorator.ts.mdx',
    'svelte/margindecorator.with-margin-component.js.mdx',
    'svelte/margindecorator.with-margin-component.ts.mdx',
    'solid/storybook-preview-global-decorator.js.mdx',
    'solid/storybook-preview-global-decorator.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

## Decorator inheritance

Like parameters, decorators can be defined globally, at the component level, and for a single story (as we’ve seen).

All decorators relevant to a story will run in the following order once the story renders:

- Global decorators, in the order they are defined
- Component decorators, in the order they are defined
- Story decorators, in the order they are defined
