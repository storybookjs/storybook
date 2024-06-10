---
title: Mocking providers
---

export const SUPPORTED_RENDERERS = ['preact', 'react', 'solid'];

<If notRenderer={SUPPORTED_RENDERERS}>

<Callout variant="info">

The [context provider pattern](https://react.dev/learn/passing-data-deeply-with-context) and how to mock it only applies to renderers that use JSX, like [React](?renderer=react) or [Solid](?renderer=solid).

</Callout>

<!-- End non-supported renderers -->

</If>

<If renderer={SUPPORTED_RENDERERS}>

Components can receive data or configuration from context providers. For example, a styled component might access its theme from a ThemeProvider or Redux uses React context to provide components access to app data. To mock a provider, you can wrap your component in a [decorator](./decorators.md) that includes the necessary context.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/storybook-preview-with-styled-components-decorator.js.mdx',
    'react/storybook-preview-with-styled-components-decorator.ts.mdx',
    'solid/storybook-preview-with-styled-components-decorator.js.mdx',
    'solid/storybook-preview-with-styled-components-decorator.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

<Callout variant="warning">

Note the file extension above (`.tsx` or `.jsx`). You may need to adjust your preview file's extension to allow use of JSX, depending on your project's settings.

</Callout>

<If renderer="react">

<Callout variant="info" icon="💡">

For another example, reference the [Screens](https://storybook.js.org/tutorials/intro-to-storybook/react/en/screen/) chapter of the Intro to Storybook tutorial, where we mock a Redux provider with mock data.

</Callout>

</If>

## Configuring the mock provider

When mocking a provider, it may be necessary to configure the provider to supply a different value for individual stories. For example, you might want to test a component with different themes or user roles.

One way to do this is to define the decorator for each story individually. But if you imagine a scenario where you wish to create stories for each of your components in both light and dark themes, this approach can quickly become cumbersome.

For a better way, with much less repetition, you can use the [decorator function's second "context" argument](./decorators.md#context-for-mocking) to access a story's [`parameters`](./parameters.md) and adjust the provided value. This way, you can define the provider once and adjust its value for each story.

For example, we can adjust the decorator from above to read from `parameters.theme` to determine which theme to provide:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/mock-provider-in-preview.js.mdx',
    'react/mock-provider-in-preview.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

Now, you can define a `theme` parameter in your stories to adjust the theme provided by the decorator:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/configure-mock-provider-with-story-parameter.js.mdx',
    'react/configure-mock-provider-with-story-parameter.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

This powerful approach allows you to provide any value (theme, user role, mock data, etc.) to your components in a way that is both flexible and maintainable.

</If>
