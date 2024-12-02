```mdx filename="src/components/Button/Button.mdx" renderer="common" language="mdx"
import { Meta, Story } from '@storybook/blocks';

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

```ts filename="src/components/Button/Button.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
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

```ts filename="src/components/Button/Button.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta: Meta<Button> = {
  // Sets the name for the stories container
  title: 'components/Button',
  // The component name will be used if `title` is not set
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

// The story variable name will be used if `name` is not set
const Primary: Story = {
  // Sets the name for that particular story
  name: 'Primary',
  args: {
    label: 'Button',
  },
};
```
