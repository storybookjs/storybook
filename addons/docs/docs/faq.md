<h1>Storybook Docs FAQs</h1>

You've read the [Storybook Docs README](../README.md). You're already familiar with both [DocsPage](./docspage.md) and [MDX](./mdx.md). You've even browsed our [Docs recipes](/./recipes.md). But Docs is a big project and you've still got questions! Maybe you'll find your answer here:

- [Does Docs support framework X?](#does-docs-support-framework-x)
- [How does Docs interact with existing addons?](#how-does-docs-interact-with-existing-addons)
- [How do I debug my MDX story?](#how-do-i-debug-my-mdx-story)
- [More resources](#more-resources)

## Does Docs support framework X?

Docs does not currently support [React Native](https://github.com/storybookjs/react-native). Otherwise, [it supports all frameworks that Storybook supports](../README.md#framework-support), including React, Vue 3, Angular, Ember, Svelte, and others.

## How does Docs interact with existing addons?

Currently we hide the addons panel when docs is visible. It's tricky because all the addons assume that there is only one story currently visible, and in docs there are potentially many. We have a proposal for "knobs v2" to address this for knobs, but nothing planned to address it in general. How we deal with it generally is [open for discussion](https://github.com/storybooks/storybook/issues/6700)!

## How do I debug my MDX story?

<center>
  <img src="https://raw.githubusercontent.com/storybookjs/storybook/master/addons/docs/docs/media/faq-debug.png" width="100%" />
</center>

> "My story renders in docs, but doesn’t show up the way I’d expect in the Canvas”

The original MDX gets compiled to Javascript, and the easiest way to debug your MDX stories in the Canvas is to inspect that Javascript. To do this, open your browser dev tools and view the source that’s being served by the webpack dev server. You may need to hunt for it a little bit under the `webpack > > . > path/to/your/stories` folder, but it’s there.

For example, the following MDX story:

```jsx
<Story name="solo story">
  <Button onClick={action('clicked')}>solo</Button>
</Story>
```

Shows up in the dev tools as follows:

<center>
  <img src="https://raw.githubusercontent.com/storybookjs/storybook/master/addons/docs/docs/media/faq-devtools.png" width="100%" />
</center>

This is [Component Story Format (CSF)](https://medium.com/storybookjs/component-story-format-66f4c32366df), so there are ways to debug. You can copy and paste this code into a new `.stories.js` file and play around with it at a lower level to understand what's going wrong.

## More resources

- References: [README](../README.md) / [DocsPage](docspage.md) / [MDX](mdx.md) / [FAQ](faq.md) / [Recipes](recipes.md) / [Theming](theming.md) / [Props](props-tables.md)
- Framework-specific docs: [React](../react/README.md) / [Vue 3](../vue3/README.md) / [Angular](../angular/README.md) / [Web components](../web-components/README.md) / [Ember](../ember/README.md)
- Announcements: [Vision](https://medium.com/storybookjs/storybook-docs-sneak-peak-5be78445094a) / [DocsPage](https://medium.com/storybookjs/storybook-docspage-e185bc3622bf) / [MDX](https://medium.com/storybookjs/rich-docs-with-storybook-mdx-61bc145ae7bc) / [Framework support](https://medium.com/storybookjs/storybook-docs-for-new-frameworks-b1f6090ee0ea)
- Example: [Storybook Design System](https://github.com/storybookjs/design-system)
