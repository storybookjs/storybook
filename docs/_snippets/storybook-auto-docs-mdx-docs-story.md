<!-- prettier-ignore -->
```mdx filename="Checkbox.mdx" renderer="common" language="mdx"
import { Canvas } from '@storybook/addon-docs/blocks';

import * as CheckboxStories from './Checkbox.stories';

<Canvas of={CheckboxStories.Unchecked} />
```

```mdx filename="Checkbox.mdx" renderer="svelte" language="mdx" tabTitle="CSF 3"
{/* ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 */}
import { Canvas } from '@storybook/addon-docs/blocks';

import * as CheckboxStories from './Checkbox.stories.svelte';

<Canvas of={CheckboxStories.Unchecked} />
```
