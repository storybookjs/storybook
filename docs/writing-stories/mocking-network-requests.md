---
title: Mocking network requests
---

For components that make network requests (e.g. fetching data from a REST or GraphQL API), you can mock those requests using a tool like [Mock Service Worker (MSW)](https://mswjs.io/). MSW is an API mocking library, which relies on service workers to capture network requests and provides mocked data in response.

The [MSW addon](https://storybook.js.org/addons/msw-storybook-addon/) brings this functionality into Storybook, allowing you to mock API requests in your stories. Below is an overview of how to set up and use the addon.

## Set up the MSW addon

First, if necessary, run this command to install MSW and the MSW addon:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
   'common/msw-addon-install.npm.js.mdx',
   'common/msw-addon-install.yarn.js.mdx',
   'common/msw-addon-install.pnpm.js.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

If you're not already using MSW, generate the service worker file necessary for MSW to work:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
   'common/msw-generate-service-worker.npx.js.mdx',
   'common/msw-generate-service-worker.pnpm.js.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

<If renderer="angular">

<Callout variant="info" icon="💡">

Angular projects will likely need to adjust the command to save the mock service worker file in a different directory (e.g., `src`).

</Callout>

</If>

Then ensure the [`staticDirs`](../api/main-config-static-dirs.md) property in your Storybook configuration will include the generated service worker file (in `/public`, by default):

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/main-config-static-dirs.js.mdx',
    'common/main-config-static-dirs.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

Finally, initialize the addon and apply it to all stories with a [project-level loader](./loaders.md#global-loaders):

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/msw-addon-initialize.js.mdx',
    'common/msw-addon-initialize.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

## Mocking REST requests

If your component fetches data from a REST API, you can use MSW to mock those requests in Storybook. As an example, consider this document screen component:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/document-screen-fetch.js.mdx',
    'react/document-screen-fetch.ts.mdx',
    'vue/document-screen-fetch.3.js.mdx',
    'vue/document-screen-fetch.3.ts.mdx',
    'angular/document-screen-fetch.ts.mdx',
    'svelte/document-screen-fetch.js.mdx',
    'svelte/document-screen-fetch.ts.mdx',
    'web-components/document-screen-fetch.js.mdx',
    'solid/document-screen-fetch.js.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

<Callout variant="info">

This example uses the [`fetch` API](https://developer.mozilla.org/en-US/docs/Web/API/fetch) to make network requests. If you're using a different library (e.g. [`axios`](https://axios-http.com/)), you can apply the same principles to mock network requests in Storybook.

</Callout>

With the MSW addon, we can write stories that use MSW to mock the REST requests. Here's an example of two stories for the document screen component: one that fetches data successfully and another that fails.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/msw-addon-configure-handlers-http.js.mdx',
    'common/msw-addon-configure-handlers-http.ts.mdx',
    'angular/msw-addon-configure-handlers-http.ts.mdx',
    'web-components/msw-addon-configure-handlers-http.js.mdx',
    'web-components/msw-addon-configure-handlers-http.ts.mdx',
  ]}
  usesCsf3
  csf2Path="writing-stories/build-pages-with-storybook#snippet-documentscreen-story-msw-rest-request"
/>

<!-- prettier-ignore-end -->

## Mocking GraphQL requests

GraphQL is another common way to fetch data in components. You can use MSW to mock GraphQL requests in Storybook. Here's an example of a document screen component that fetches data from a GraphQL API:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/document-screen-with-graphql.js.mdx',
    'react/document-screen-with-graphql.ts.mdx',
    'vue/document-screen-with-graphql.3.js.mdx',
    'vue/document-screen-with-graphql.3.ts.mdx',
    'angular/document-screen-with-graphql.ts.mdx',
    'svelte/document-screen-with-grapqhl.js.mdx',
    'svelte/document-screen-with-grapqhl.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

<Callout variant="info">

This example uses GraphQL with [Apollo Client](https://www.apollographql.com/docs/) to make network requests. If you're using a different library (e.g. [URQL](https://formidable.com/open-source/urql/) or [React Query](https://react-query.tanstack.com/)), you can apply the same principles to mock network requests in Storybook.

</Callout>

The MSW addon allows you to write stories that use MSW to mock the GraphQL requests. Here's an example demonstrating two stories for the document screen component. The first story fetches data successfully, while the second story fails.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/msw-addon-configure-handlers-graphql.js.mdx',
    'react/msw-addon-configure-handlers-graphql.ts.mdx',
    'vue/apollo-wrapper-component.with-mock-implementation.3.js.mdx',
    'vue/msw-addon-configure-handlers-graphql.js.mdx',
    'vue/msw-addon-configure-handlers-graphql.ts.mdx',
    'angular/apollo-module.mock-apollo-module.ts.mdx',
    'angular/msw-addon-configure-handlers-graphql.ts.mdx',
    'svelte/msw-addon-configure-handlers-graphql.js.mdx',
    'svelte/msw-addon-configure-handlers-graphql.ts.mdx',
    'svelte/apollo-wrapper-component.with-mock-implementation.js.mdx',
    'svelte/apollo-wrapper-component.with-mock-implementation.ts.mdx',
  ]}
  usesCsf3
  csf2Path="writing-stories/build-pages-with-storybook#snippet-documentscreen-story-msw-graphql-query"
/>

<!-- prettier-ignore-end -->

## Configuring MSW for stories

In the examples above, note how each story is configured with `parameters.msw` to define the request handlers for the mock server. Because it uses parameters in this way, it can also be configured at the [component](./parameters.md#component-parameters) or even [project](./parameters.md#global-parameters) level, allowing you to share the same mock server configuration across multiple stories.
