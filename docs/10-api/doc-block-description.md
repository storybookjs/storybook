---
title: 'Description'
---

<YouTubeCallout id="uAA1JvLcl-w" title="Avoid Documentation Nightmares with Storybook's Description Doc Block" params='start=84' />

The `Description` block displays the description for a component, story, or meta, obtained from their respective JSDoc comments.

![Screenshot of Description block](./doc-block-title-subtitle-description.png)

```md
{/_ ButtonDocs.mdx _/}

import { Meta, Description } from '@storybook/blocks';
import \* as ButtonStories from './Button.stories';

<Meta of={ButtonStories} />

<Description of={ButtonStories.Primary} />
```

## Description

```js
import { Description } from '@storybook/blocks';
```

`Description` is configured with the following props:

### `of`

Type: Story export or CSF file exports

Specifies where to pull the description from. It can either point to a story or a meta, depending on which description you want to show.

Descriptions are pulled from the JSDoc comments or parameters, and they are rendered as markdown. See [Writing descriptions](#writing-descriptions) for more details.

### `children`

(⛔️ **Deprecated**)

Type: `string`

See [Migration guide](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#description-block-parametersnotes-and-parametersinfo).

### `markdown`

(⛔️ **Deprecated**)

Type: `string`

See [Migration guide](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#description-block-parametersnotes-and-parametersinfo).

### `type`

(⛔️ **Deprecated**)

Type: `'info' | 'notes' | 'docgen' | 'auto'`

See [Migration guide](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#description-block-parametersnotes-and-parametersinfo).

## Writing descriptions

There are multiple places to write the description of a component/story, depending on what you want to achieve. Descriptions can be written at the story level to describe each story of a component, or they can be written at the meta or component level to describe the component in general.

Descriptions can be written as [JSDoc comments](https://jsdoc.app/about-getting-started.html) above stories, meta, or components. Alternatively they can also be specified in [`parameters`](../writing-stories/parameters.md). To describe a story via parameters instead of comments, add it to `parameters.docs.description.story`; to describe meta/component, add it to `parameters.docs.description.component`.

We recommend using JSDoc comments for descriptions, and only use the `parameters.docs.description.X` properties in situations where comments are not possible to write for some reason, or where you want the description shown in Storybook to be different from the comments. Comments provide a better writing experience as you don’t have to worry about indentation, and they are more discoverable for other developers that are exploring the story/component sources.

When documenting a story, reference a story export in the `of` prop (see below) and the Description block will look for descriptions in the following order:

1. `parameters.docs.description.story` in the story
2. JSDoc comments above the story

When documenting a component, reference a meta export in the `of` prop (see below) and the Description block will look for descriptions in the following order:

1. `parameters.docs.description.component` in the meta
2. JSDoc comments above the meta
3. JSDoc comments above the component

This flow gives you powerful ways to override the description for each scenario. Take the following example:

```jsx
// Button.jsx

/**
 * # The Button component
 * Shows a button
 */
export const Button = () => <button>Click me</button>;
```

<CodeSnippets
paths={[
'angular/api-doc-block-description-example.ts.mdx',
'web-components/api-doc-block-description-example.js.mdx',
'web-components/api-doc-block-description-example.ts.mdx',
'common/api-doc-block-description-example.js.mdx',
'common/api-doc-block-description-example.ts.mdx',
]}
/>

```md
{/_ ButtonDocs.mdx _/}

import { Meta, Description } from '@storybook/blocks';
import \* as ButtonStories from './Button.stories';

<Meta of={ButtonStories} />

{/_ Shows the description for the default export (the meta).
If that didn't have any comments, it would show the
comments from the component instead _/}
<Description of={ButtonStories} />

{/_ Shows the description for the Primary export _/}
<Description of={ButtonStories.Primary} />
```
