<!-- prettier-ignore -->
```mdx filename="Button.mdx" renderer="common" language="mdx"
import { Meta, Story } from '@storybook/blocks';

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
```mdx filename="Button.mdx" renderer="svelte" language="mdx" tabTitle="Svelte CSF"
import { Meta, Story } from '@storybook/blocks';

import * as ButtonStories from './Button.stories.svelte';

<Meta of={ButtonStories} />

# Button

Button is a clickable interactive element that triggers a response.

You can place text and icons inside of a button.

Buttons are often used for form submissions and to toggle elements into view.

## Usage

<Story of={ButtonStories.Basic} />
```

<!-- prettier-ignore -->
```mdx filename="Button.mdx" renderer="svelte" language="mdx" tabTitle="CSF"
import { Meta, Story } from '@storybook/blocks';

import * as ButtonStories from './Button.stories';

<Meta of={ButtonStories} />

# Button

Button is a clickable interactive element that triggers a response.

You can place text and icons inside of a button.

Buttons are often used for form submissions and to toggle elements into view.

## Usage

<Story of={ButtonStories.Basic} />
```
