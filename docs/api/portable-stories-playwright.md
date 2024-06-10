---
title: 'Portable stories in Playwright CT'
---

export const SUPPORTED_RENDERERS = ['react', 'vue'];

(⚠️ **Experimental**)

<If notRenderer={SUPPORTED_RENDERERS}>

<Callout variant="info">

Portable stories are currently only supported in [React](?renderer=react) and [Vue](?renderer=vue) projects.

</Callout>

<!-- End non-supported renderers -->

</If>

<If renderer={SUPPORTED_RENDERERS}>

<Callout variant="info">

The portable stories API for Playwright CT is experimental. Playwright CT itself is also experimental. Breaking changes might occur in either library in upcoming releases.

</Callout>

Portable stories are Storybook [stories](../writing-stories/index.md) which can be used in external environments, such as [Playwright Component Tests (CT)](https://playwright.dev/docs/test-components).

Normally, Storybook composes a story and its [annotations](#annotations) automatically, as part of the [story pipeline](#story-pipeline). When using stories in Playwright CT, you can use the [`createTest`](#createtest) function, which extends Playwright's test functionality to add a custom `mount` mechanism, to take care of the story pipeline for you.

<If renderer="react">

<Callout variant="warning">

Your project must be using React 18+ to use the portable stories API with Playwright CT.

**Using `Next.js`?** The portable stories API is not yet supported in Next.js with Playwright CT.

<!-- **Using `Next.js`?** Next.js requires specific configuration that is only available in [Jest](./portable-stories-jest.md). The portable stories API is not supported in Next.js with Playwright CT. -->

</Callout>

</If>

<If renderer="vue">

<Callout variant="info">

If your stories use template-based Vue components, you may need to [alias the `vue` module](https://vuejs.org/guide/scaling-up/tooling#note-on-in-browser-template-compilation) to resolve correctly in the Playwright CT environment. You can do this via the [`ctViteConfig` property](https://playwright.dev/docs/test-components#i-have-a-project-that-already-uses-vite-can-i-reuse-the-config):

<details>
<summary>Example Playwright configuration</summary>

```ts
// playwright-config.ts
import { defineConfig } from '@playwright/experimental-ct-vue';

export default defineConfig({
  ctViteConfig: {
    resolve: {
      alias: {
        vue: 'vue/dist/vue.esm-bundler.js',
      },
    },
  },
});
```

</details>

</Callout>

</If>

## createTest

(⚠️ **Experimental**)

Instead of using Playwright's own `test` function, you can use Storybook's special `createTest` function to [extend Playwright's base fixture](https://playwright.dev/docs/test-fixtures#creating-a-fixture) and override the `mount` function to load, render, and play the story. This function is experimental and is subject to changes.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/portable-stories-playwright-ct.ts.mdx',
    'vue/portable-stories-playwright-ct.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

<Callout icon="ℹ️">

The code which you write in your Playwright test file is transformed and orchestrated by Playwright, where part of the code executes in Node, while other parts execute in the browser.

Because of this, you have to compose the stories _in a separate file than your own test file_:

```ts
// Button.stories.portable.ts
// Replace <your-renderer> with your renderer, e.g. react, vue3
import { composeStories } from '@storybook/<your-renderer>';

import * as stories from './Button.stories';

// This function will be executed in the browser
// and compose all stories, exporting them in a single object
export default composeStories(stories);
```

You can then import the composed stories in your Playwright test file, as in the example above.

</Callout>

### Type

```ts
createTest(
  baseTest: PlaywrightFixture
) => PlaywrightFixture
```

### Parameters

#### `baseTest`

(**Required**)

Type: `PlaywrightFixture`

The base test function to use, e.g. `test` from Playwright.

### Return

Type: `PlaywrightFixture`

A Storybook-specific test function with the custom `mount` mechanism.

## setProjectAnnotations

This API should be called once, before the tests run, in [`playwright/index.ts`](https://playwright.dev/docs/test-components#step-1-install-playwright-test-for-components-for-your-respective-framework). This will make sure that when `mount` is called, the project annotations are taken into account as well.

```ts
// playwright/index.ts
// Replace <your-renderer> with your renderer, e.g. react, vue3
import { setProjectAnnotations } from '@storybook/<your-renderer>';
import * as addonAnnotations from 'my-addon/preview';
import * as previewAnnotations from '../.storybook/preview';

setProjectAnnotations([previewAnnotations, addonAnnotations]);
```

<Callout variant="warning">

Sometimes a story can require an addon's [decorator](../writing-stories/decorators.md) or [loader](../writing-stories/loaders.md) to render properly. For example, an addon can apply a decorator that wraps your story in the necessary router context. In this case, you must include that addon's `preview` export in the project annotations set. See `addonAnnotations` in the example above.

Note: If the addon doesn't automatically apply the decorator or loader itself, but instead exports them for you to apply manually in `.storybook/preview.js|ts` (e.g. using `withThemeFromJSXProvider` from [@storybook/addon-themes](https://github.com/storybookjs/storybook/blob/next/code/addons/themes/docs/api.md#withthemefromjsxprovider)), then you do not need to do anything else. They are already included in the `previewAnnotations` in the example above.

</Callout>

### Type

```ts
(projectAnnotations: ProjectAnnotation | ProjectAnnotation[]) => void
```

### Parameters

#### `projectAnnotations`

(**Required**)

Type: `ProjectAnnotation | ProjectAnnotation[]`

A set of project [annotations](#annotations) (those defined in `.storybook/preview.js|ts`) or an array of sets of project annotations, which will be applied to all composed stories.

## Annotations

Annotations are the metadata applied to a story, like [args](../writing-stories/args.md), [decorators](../writing-stories/decorators.md), [loaders](../writing-stories/loaders.md), and [play functions](../writing-stories/play-function.md). They can be defined for a specific story, all stories for a component, or all stories in the project.

<Callout variant="info">

[Read more about Playwright's component testing](https://playwright.dev/docs/test-components#test-stories).

</Callout>

## Story pipeline

To preview your stories, Storybook runs a story pipeline, which includes applying project annotations, loading data, rendering the story, and playing interactions. This is a simplified version of the pipeline:

![A flow diagram of the story pipeline. First, set project annotations. Storybook automatically collects decorators etc. which are exported by addons and the .storybook/preview file. .storybook/preview.js produces project annotations; some-addon/preview produces addon annotations. The rest of the steps are labeled as a group, Playwright test. Second, prepare. Storybook gathers all the metadata required for a story to be composed. Select.stories.js produces component annotations from the default export and story annotations from the named export. Third, load. Storybook executes all loaders (async). Fourth, render. Storybook renders the story as a component. Illustration of the rendered Select component. Fifth, play. Storybook runs the play function (interacting with component). Illustration of the renderer Select component, now open.](story-pipeline-playwright-ct.png)

When you want to reuse a story in a different environment, however, it's crucial to understand that all these steps make a story. The portable stories API provides you with the mechanism to recreate that story pipeline in your external environment:

### 1. Apply project-level annotations

[Annotations](#annotations) come from the story itself, that story's component, and the project. The project-level annotatations are those defined in your `.storybook/preview.js` file and by addons you're using. In portable stories, these annotations are not applied automatically—you must apply them yourself.

👉 For this, you use the [`setProjectAnnotations`](#setprojectannotations) API.

### 2. Prepare, load, render, and play

The story pipeline includes preparing the story, [loading data](../writing-stories/loaders.md), rendering the story, and [playing interactions](../essentials/interactions.md#play-function-for-interactions). In portable stories within Playwright CT, the `mount` function takes care of these steps for you.

👉 For this, you use the [`createTest`](#createtest) API.

<Callout variant="info">

If your play function contains assertions (e.g. `expect` calls), your test will fail when those assertions fail.

</Callout>

## Overriding globals

If your stories behave differently based on [globals](../essentials/toolbars-and-globals.md#globals) (e.g. rendering text in English or Spanish), you can define those global values in portable stories by overriding project annotations when composing a story:

<!-- prettier-ignore-start -->

```tsx
// Button.portable.ts
import { test } from 'playwright';
import { render } from '@testing-library/react';
import { composeStory } from '@storybook/react';

import meta, { Primary } from './Button.stories';

export const PrimaryEnglish = composeStory(
  Primary,
  meta,
  { globals: { locale: 'en' } } // 👈 Project annotations to override the locale
);

export const PrimarySpanish =
  composeStory(Primary, meta, { globals: { locale: 'es' } });
```

You can then use those composed stories in your Playwright test file using the [`createTest`](#createtest) function.

<!-- prettier-ignore-end -->

<!-- End supported renderers -->

</If>
