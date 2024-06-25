---
title: 'Stories'
---

<YouTubeCallout id="uAA1JvLcl-w" title="Avoid Documentation Nightmares with Storybook's Stories Doc Block" params='start=185' />

The `Stories` block renders the full collection of stories in a stories file.

![Screenshot of Stories block](./doc-block-stories.png)

<!-- prettier-ignore-start -->
```md
{/* ButtonDocs.mdx */}

import { Meta, Stories } from '@storybook/blocks';
import * as ButtonStories from './Button.stories';

<Meta of={ButtonStories} />

<Stories />
```
<!-- prettier-ignore-end -->

## Stories

```js
import { Stories } from '@storybook/blocks';
```

`Stories` is configured with the following props:

### `includePrimary`

Type: `boolean`

Default: `parameters.docs.stories.includePrimary`

Determines if the collection of stories includes the primary (first) story.

<Callout variant="info" icon="💡">

If a stories file contains only one story and `includePrimary={true}`, the `Stories` block will render nothing to avoid a potentially confusing situation.

</Callout>

### `of`

Type: CSF file exports

Specifies which meta's stories are displayed.

### `title`

Type: `string`

Default: `parameters.docs.stories.title`

Sets the heading content preceding the collection of stories.
