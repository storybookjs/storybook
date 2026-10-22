<!-- prettier-ignore -->
```mdx filename="Checkbox.mdx" renderer="common" language="mdx"
import { Canvas, Meta } from '@storybook/addon-docs/blocks';

import * as CheckboxStories from './Checkbox.stories';

<Meta of={CheckboxStories} />

# Checkbox

A checkbox is a square box that can be activated or deactivated when ticked.

Use checkboxes to select one or more options from a list of choices.

<Canvas of={CheckboxStories.Unchecked} />
```

<!-- prettier-ignore -->
```mdx filename="Checkbox.mdx" renderer="svelte" language="mdx" tabTitle="Svelte CSF 3"
{/* ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 */}
import { Canvas, Meta } from '@storybook/addon-docs/blocks';

import * as CheckboxStories from './Checkbox.stories.svelte';

<Meta of={CheckboxStories} />

# Checkbox

A checkbox is a square box that can be activated or deactivated when ticked.

Use checkboxes to select one or more options from a list of choices.

<Canvas of={CheckboxStories.Unchecked} />
```
