<!-- prettier-ignore -->
```mdx filename="src/components/Button/Button.mdx" renderer="common" language="mdx"
import { Meta, Story } from '@storybook/addon-docs/blocks';

{/* 👇 Documentation-only page */}

<Meta title="Documentation" />

{/* 👇 Component documentation page */}
import * as ButtonStories from './Button.stories';

<Meta of={ButtonStories} />

<Story of={ButtonStories.Primary} />
```

```js filename="src/components/Button/Button.stories.js|jsx" renderer="common" language="js"
import { Button } from './Button';

export default {
  // Sets the name for the stories container
  title: 'components/Button',
  // The component name will be used if `title` is not set
  component: Button,
};

// The story variable name will be used if `name` is not set
const Primary = {
  // Sets the name for that particular story
  name: 'Primary',
  args: {
    label: 'Button',
  },
};
```

```ts filename="src/components/Button/Button.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  // Sets the name for the stories container
  title: 'components/Button',
  // The component name will be used if `title` is not set
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// The story variable name will be used if `name` is not set
const Primary: Story = {
  // Sets the name for that particular story
  name: 'Primary',
  args: {
    label: 'Button',
  },
};
```
