<!-- prettier-ignore -->
```mdx filename="Button.mdx" renderer="common" language="mdx"
import { Meta, Story } from '@storybook/addon-docs/blocks';

import * as ButtonStories from './Button.stories';

<Meta of={ButtonStories} />

# Button

Button is a clickable interactive element that triggers a response.

You can place text and icons inside of a button.

Buttons are often used for form submissions and to toggle elements into view.

## Usage

<Story of={ButtonStories.Basic} />
```

<!-- prettier-ignore -->
```mdx filename="Button.mdx" renderer="svelte" language="mdx" tabTitle="CSF 3"
{/* ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 */}
import { Meta, Story } from '@storybook/addon-docs/blocks';

import * as ButtonStories from './Button.stories.svelte';

<Meta of={ButtonStories} />

# Button

Button is a clickable interactive element that triggers a response.

You can place text and icons inside of a button.

Buttons are often used for form submissions and to toggle elements into view.

## Usage

<Story of={ButtonStories.Basic} />
```
