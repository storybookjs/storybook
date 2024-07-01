```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

/**
 * # Button stories
 * These stories showcase the button
 */
const meta: Meta<Button> = {
  component: Button
  parameters: {
    docs: {
      description: {
        component: 'Another description, overriding the comments'
      },
    },
  },
};

export default meta;
type Story = StoryObj<Button>;

/**
 * # Primary Button
 * This is the primary button
 */
export const Primary: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments'
      },
    },
  },
};
```

```js filename="Button.stories.js|jsx" renderer="common" language="js"
import { Button } from './Button';

/**
 * # Button stories
 * These stories showcase the button
 */
export default {
  component: Button
  parameters: {
    docs: {
      description: {
        component: 'Another description, overriding the comments'
      }
    }
  }
}

/**
 * # Primary Button
 * This is the primary button
 */
export const Primary = {
  parameters: {
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments'
      }
    }
  }
}
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

/**
 * # Button stories
 * These stories showcase the button
 */
const meta = {
  component: Button
  parameters: {
    docs: {
      description: {
        component: 'Another description, overriding the comments'
      }
    }
  }
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>

/**
 * # Primary Button
 * This is the primary button
 */
export const Primary: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments'
      }
    }
  }
}
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

/**
 * # Button stories
 * These stories showcase the button
 */
const meta: Meta<typeof Button> = {
  component: Button
  parameters: {
    docs: {
      description: {
        component: 'Another description, overriding the comments'
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

/**
 * # Primary Button
 * This is the primary button
 */
export const Primary: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments'
      },
    },
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  title: 'Button',
  component: 'demo-button',
  parameters: {
    docs: {
      description: {
        component: 'Another description, overriding the comments',
      },
    },
  },
};

/**
 * # Button stories
 * These stories showcase the button
 */
export const Primary = {
  parameters: {
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments',
      },
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

/**
 * # Button stories
 * These stories showcase the button
 */
const meta: Meta = {
  title: 'Button',
  component: 'demo-button',
  parameters: {
    docs: {
      description: {
        component: 'Another description, overriding the comments',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/**
 * # Primary Button
 * This is the primary button
 */
export const Primary: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments',
      },
    },
  },
};
```

