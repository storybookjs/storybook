<!-- add file name into the definition and re-adjust this for comments (incorrect formatting) -->

```mdx filename="Checkbox.mdx" renderer="common" language="mdx"
import { Canvas, Meta } from '@storybook/blocks';

import * as CheckboxStories from './Checkbox.stories';

<Meta of={CheckboxStories} />

# Checkbox

A checkbox is a square box that can be activated or deactivated when ticked.

Use checkboxes to select one or more options from a list of choices.

<Canvas of={CheckboxStories.Unchecked} />
```
