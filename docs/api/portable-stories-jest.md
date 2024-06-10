---
title: 'Portable stories in Jest'
---

<!-- This page is unpublished for now -->

export const SUPPORTED_RENDERERS = ['react', 'vue'];

<If notRenderer={SUPPORTED_RENDERERS}>

<Callout variant="info">

Portable stories in Jest are currently only supported in [React](?renderer=react) and [Vue](?renderer=vue) projects.

</Callout>

<!-- End non-supported renderers -->

</If>

<If renderer={SUPPORTED_RENDERERS}>

Portable stories are Storybook [stories](../writing-stories/index.md) which can be used in external environments, such as [Jest](https://jestjs.io).

Normally, Storybook composes a story and its [annotations](#annotations) automatically, as part of the [story pipeline](#story-pipeline). When using stories in Jest tests, you must handle the story pipeline yourself, which is what the [`composeStories`](#composestories) and [`composeStory`](#composestory) functions enable.

<If renderer="react">

<Callout variant="info">

**Using `Next.js`?** You need to do three things differently when using portable stories in Jest with Next.js projects:

- Configure the [`next/jest.js` transformer](https://nextjs.org/docs/pages/building-your-application/testing/jest#manual-setup), which will handle all of the necessary Next.js configuration for you.
- Import [`composeStories`](#composestories) or [`composeStory`](#composestory) from the `@storybook/nextjs` package (e.g. `import { composeStories } from '@storybook/nextjs'`).
- Set up [internal module aliases](../get-started/nextjs.md#storybooknextjsexport-mocks) to ensure the framework configuration works correctly and to be able to mock and assert on them.

</Callout>

</If>

## composeStories

`composeStories` will process the component's stories you specify, compose each of them with the necessary [annotations](#annotations), and return an object containing the composed stories.

By default, the composed story will render the component with the [args](../writing-stories/args.md) that are defined in the story. You can also pass any props to the component in your test and those props will override the values passed in the story's args.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/portable-stories-jest-compose-stories.ts.mdx',
    'vue/portable-stories-jest-compose-stories.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

### Type

<!-- prettier-ignore-start -->
```ts
(
  csfExports: CSF file exports,
  projectAnnotations?: ProjectAnnotations
) => Record<string, ComposedStoryFn>
```
<!-- prettier-ignore-end -->

### Parameters

#### `csfExports`

(**Required**)

Type: CSF file exports

Specifies which component's stories you want to compose. Pass the **full set of exports** from the CSF file (not the default export!). E.g. `import * as stories from './Button.stories'`

#### `projectAnnotations`

Type: `ProjectAnnotation | ProjectAnnotation[]`

Specifies the project annotations to be applied to the composed stories.

This parameter is provided for convenience. You should likely use [`setProjectAnnotations`](#setprojectannotations) instead. Details about the `ProjectAnnotation` type can be found in that function's [`projectAnnotations`](#projectannotations-2) parameter.

This parameter can be used to [override](#overriding-globals) the project annotations applied via `setProjectAnnotations`.

### Return

Type: `Record<string, ComposedStoryFn>`

An object where the keys are the names of the stories and the values are the composed stories.

Additionally, the composed story will have the following properties:

| Property   | Type                                                     | Description                                                                           |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| storyName  | `string`                                                 | The story's name                                                                      |
| args       | `Record<string, any>`                                    | The story's [args](../writing-stories/args.md)                                        |
| argTypes   | `ArgType`                                                | The story's [argTypes](./arg-types.md)                                                |
| id         | `string`                                                 | The story's id                                                                        |
| parameters | `Record<string, any>`                                    | The story's [parameters](./parameters.md)                                             |
| load       | `() => Promise<void>`                                    | [Prepares](#3-prepare) the story for rendering and and cleans up all previous stories |
| play       | `(context?: StoryContext) => Promise<void> \| undefined` | Executes the [play function](#5-play) of a given story                                |

## composeStory

You can use `composeStory` if you wish to compose a single story for a component.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/portable-stories-jest-compose-story.ts.mdx',
    'vue/portable-stories-jest-compose-story.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

### Type

<!-- prettier-ignore-start -->
```ts
(
  story: Story export,
  componentAnnotations: Meta,
  projectAnnotations?: ProjectAnnotations,
  exportsName?: string
) => ComposedStoryFn
```
<!-- prettier-ignore-end -->

### Parameters

#### `story`

(**Required**)

Type: `Story export`

Specifies which story you want to compose.

#### `componentAnnotations`

(**Required**)

Type: `Meta`

The default export from the stories file containing the [`story`](#story).

#### `projectAnnotations`

Type: `ProjectAnnotation | ProjectAnnotation[]`

Specifies the project annotations to be applied to the composed story.

This parameter is provided for convenience. You should likely use [`setProjectAnnotations`](#setprojectannotations) instead. Details about the `ProjectAnnotation` type can be found in that function's [`projectAnnotations`](#projectannotations-2) parameter.

This parameter can be used to [override](#overriding-globals) the project annotations applied via `setProjectAnnotations`.

#### `exportsName`

Type: `string`

You probably don't need this. Because `composeStory` accepts a single story, it does not have access to the name of that story's export in the file (like `composeStories` does). If you must ensure unique story names in your tests and you cannot use `composeStories`, you can pass the name of the story's export here.

### Return

Type: `ComposedStoryFn`

A single [composed story](#return).

## setProjectAnnotations

This API should be called once, before the tests run, typically in a [setup file](https://jestjs.io/docs/configuration#setupfiles-array). This will make sure that whenever `composeStories` or `composeStory` are called, the project annotations are taken into account as well.

<If renderer="react">

<Callout variant="info">

**Using `Next.js`?** When you import [`composeStories`](#composestories) or [`composeStory`](#composestory) from the `@storybook/nextjs` package (e.g. `import { composeStories } from '@storybook/nextjs'`), you probably do not need to call `setProjectAnnotations` yourself. The Next.js framework will handle this for you.

If you are using an addon that is required for your stories to render, you will still need to include that addon's `preview` export in the project annotations set. See the example and callout below.

</Callout>

<p></p>

</If>

```ts
// setup-portable-stories.ts
// Replace <your-renderer> with your renderer, e.g. nextjs, react, vue3
import { setProjectAnnotations } from '@storybook/<your-renderer>';
import * as addonAnnotations from 'my-addon/preview';
import * as previewAnnotations from './.storybook/preview';

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

## Story pipeline

To preview your stories, Storybook runs a story pipeline, which includes applying project annotations, loading data, rendering the story, and playing interactions. This is a simplified version of the pipeline:

![A flow diagram of the story pipeline. First, set project annotations. Storybook automatically collects decorators etc. which are exported by addons and the .storybook/preview file. .storybook/preview.js produces project annotations; some-addon/preview produces addon annotations. Second, prepare. Storybook gathers all the metadata required for a story to be composed. Select.stories.js produces component annotations from the default export and story annotations from the named export. Third, load. Storybook executes all loaders (async). Fourth, render. Storybook renders the story as a component. Illustration of the rendered Select component. Fifth, play. Storybook runs the play function (interacting with component). Illustration of the renderer Select component, now open.](story-pipeline.png)

When you want to reuse a story in a different environment, however, it's crucial to understand that all these steps make a story. The portable stories API provides you with the mechanism to recreate that story pipeline in your external environment:

### 1. Apply project-level annotations

[Annotations](#annotations) come from the story itself, that story's component, and the project. The project-level annotatations are those defined in your `.storybook/preview.js` file and by addons you're using. In portable stories, these annotations are not applied automatically—you must apply them yourself.

👉 For this, you use the [`setProjectAnnotations`](#setprojectannotations) API.

### 2. Compose

The story is prepared by running [`composeStories`](#composestories) or [`composeStory`](#composestory). You do not need to do anything for this step.

### 3. Prepare

Stories can prepare data they need (e.g. setting up some mocks or fetching data) before rendering by defining [loaders](../writing-stories/loaders.md) or [beforeEach](../writing-tests/interaction-testing.md#run-code-before-each-test). In portable stories, loaders and beforeEach are not applied automatically — you have to apply them yourself.

👉 For this, you use the [`composeStories`](#composestories) or [`composeStory`](#composestory) API. The composed story will return a `load` method to be called **before** it is rendered.

<Callout variant="info">

It is recommended to always run `load` before rendering, even if the story doesn't have any loaders or beforeEach applied. By doing so, you ensure that the tests are cleaned up properly to maintain isolation and you will not have to update your test if you later add them to your story.

</Callout>

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/portable-stories-jest-with-loaders.ts.mdx',
    'vue/portable-stories-jest-with-loaders.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

### 4. Render

At this point, the story has been prepared and can be rendered. You pass it into the

The story has been prepared and can be rendered. To render, you pass it into the rendering mechanism of your choice (e.g. Testing Library render function, Vue test utils mount function, etc).

👉 For this, you use the [`composeStories`](#composestories) or [`composeStory`](#composestory) API. The composed Story is a renderable component that can be passed to your rendering mechanism.

### 5. Play

**(optional)**

Finally, stories can define a [play function](../essentials/interactions.md#play-function-for-interactions) to interact with the story and assert on details after it has rendered. In portable stories, the play function does not run automatically—you have to call it yourself.

👉 For this, you use the [`composeStories`](#composestories) or [`composeStory`](#composestory) API. The composed Story will return a `play` method to be called **after** it has rendered.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/portable-stories-jest-with-play-function.ts.mdx',
    'vue/portable-stories-jest-with-play-function.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

<Callout variant="info">

If your play function contains assertions (e.g. `expect` calls), your test will fail when those assertions fail.

</Callout>

## Overriding globals

If your stories behave differently based on [globals](../essentials/toolbars-and-globals.md#globals) (e.g. rendering text in English or Spanish), you can define those global values in portable stories by overriding project annotations when composing a story:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/portable-stories-jest-override-globals.ts.mdx',
    'vue/portable-stories-jest-override-globals.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

<!-- End supported renderers -->

</If>
