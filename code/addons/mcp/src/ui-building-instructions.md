# Writing User Interfaces

When writing UI, prefer breaking larger components up into smaller parts.

ALWAYS write a Storybook story for any component written. If editing a component, ensure appropriate changes have been made to stories for that component.

## Storybook 9 Essential Changes for Story Writing

### Package Consolidation

#### `Meta` and `StoryObj` imports

Update story imports to use the framework package:

```diff
- import { Meta, StoryObj } from '{{RENDERER}}';
+ import { Meta, StoryObj } from '{{FRAMEWORK}}';
```

#### Test utility imports

Update test imports to use `storybook/test` instead of `@storybook/test`

```diff
- import { fn } from '@storybook/test';
+ import { fn } from 'storybook/test';
```

### Global State Changes

The `globals` annotation has be renamed to `initialGlobals`:

```diff
// .storybook/preview.js
export default {
- globals: { theme: 'light' }
+ initialGlobals: { theme: 'light' }
};
```

### Autodocs Configuration

Instead of `parameters.docs.autodocs` in main.js, use tags:

```js
// .storybook/preview.js or in individual stories
export default {
	tags: ['autodocs'], // generates autodocs for all stories
};
```

### Mocking imports in Storybook

To mock imports in Storybook, use Storybook's mocking features. ALWAYS mock external dependencies to ensure stories render consistently.

1. **Register in the mock in Storybook's preview file**:
   To mock dependendencies, you MUST register a module mock in `.storybook/preview.ts` (or equivalent):

```js
import { sb } from 'storybook/test';

// Prefer spy mocks (keeps functions, but allows to override them and spy on them)
sb.mock(import('some-library'), { spy: true });
```

2. **Specify mock values in stories**:
   You can override the behaviour of the mocks per-story using `beforeEach` and the `mocked()` type function:

```js
import { expect, mocked, fn } from 'storybook/test';
import { library } from 'some-library';

const meta = {
  component: AuthButton,
  beforeEach: async () => {
    mocked(library).mockResolvedValue({  user: 'data' });
  },
};

export const LoggedIn: Story = {
  play: async ({ canvas }) => {
    await expect(library).toHaveBeenCalled();
  },
};
```

Before doing this ensure you have mocked the import in the preview file.

### Key Requirements

- **Node.js 20+**, **TypeScript 4.9+**, **Vite 5+**
- React Native uses `.rnstorybook` directory

## Story Linking Agent Behavior

- ALWAYS provide story links after any changes to stories files, including changes to existing stories.
- After changing any UI components, ALWAYS search for related stories that might cover the changes you've made. If you find any, provide the story links to the user. THIS IS VERY IMPORTANT, as it allows the user to visually inspect the changes you've made. Even later in a session when changing UI components or stories that have already been linked to previously, YOU MUST PROVIDE THE LINKS AGAIN.
- Use the {{PREVIEW_STORIES_TOOL_NAME}} tool to get the correct URLs for links to stories.
