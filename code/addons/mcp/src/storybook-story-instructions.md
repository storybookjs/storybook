# Writing User Interfaces

When writing UI, prefer breaking larger components up into smaller parts.

ALWAYS write a Storybook story for any component written. If editing a component, ensure appropriate changes have been made to stories for that component.

## How to write good stories

Goal: Cover every distinct piece of business logic and state the component can reach (happy paths, error/edge states, loading, permissions/roles, empty states, variations from props/context). Avoid redundant stories that show the same logic.

Interactivity: If the component is interactive, add Interaction tests using play functions that drive the UI with storybook/test utilities (e.g., fn, userEvent, expect). Simulate key user flows: clicking buttons/links, typing, focus/blur, keyboard nav, form submit, async responses, toggle/selection changes, pagination/filters, etc. When passing `fn` functions as `args` for callback functions, make sure to add a play function which interacts with the component and assert whether the callback function was actually called.

Data/setup: Provide realistic props, state, and mocked data. Include meaningful labels/text to make behaviors observable. Stub network/services with deterministic fixtures; keep stories reliable.

Assertions: In play functions, assert the visible outcome of the interaction (text, aria state, enabled/disabled, class/state changes, emitted events). Prefer role/label-based queries.

Variants to consider (pick only those that change behavior): default vs. alternate themes; loading vs. loaded vs. empty vs. error; validated vs. invalid input; permissions/roles/capabilities; feature flags; size/density/layout variants that alter logic.

Accessibility: Use semantic roles/labels; ensure focusable/keyboard interactions are test-covered where relevant.

Naming/structure: Use clear story names that describe the scenario (“Error state after failed submit”). Group related variants logically; don’t duplicate.

Imports/format: Import Meta/StoryObj from the framework package; import test helpers from storybook/test (not @storybook/test). Keep stories minimal—only what's needed to demonstrate behavior.

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

**Important: Use file extensions when referring to relative files!**

```js
sb.mock(import('./relative/module.ts'), { spy: true });
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

### Play Function Parameters

- The play function has a `canvas` parameter that can be used directly with testing-library-like query methods.
- It also has a `canvasElement` which is the actual DOM element.
- The `within`-function imported from `storybook/test` transforms a DOM element to an object with query methods, similar to `canvas`.

**DO NOT** use `within(canvas)` - it is redundant because `canvas` already has the query methods, `canvas` is not a DOM element.

```ts
// ✅ Correct: Use canvas directly
play: async ({ canvas }) => {
	await canvas.getByLabelText('Submit').click();
};

// ⚠️ Also acceptable: Use `canvasElement` with `within`
import { within } from 'storybook/test';

play: async ({ canvasElement }) => {
	const canvas = within(canvasElement);
	await canvas.getByLabelText('Submit').click();
};

// ❌ Wrong: Do NOT use within(canvas)
play: async ({ canvas }) => {
	const screen = within(canvas); // Error!
};
```

### Key Requirements

- **Node.js 20+**, **TypeScript 4.9+**, **Vite 5+**
- React Native uses `.rnstorybook` directory

## Story Linking Agent Behavior

- ALWAYS provide story links after any changes to stories files, including changes to existing stories.
- After changing any UI components, ALWAYS search for related stories that might cover the changes you've made. If you find any, provide the story links to the user. THIS IS VERY IMPORTANT, as it allows the user to visually inspect the changes you've made. Even later in a session when changing UI components or stories that have already been linked to previously, YOU MUST PROVIDE THE LINKS AGAIN.
- Use the {{GET_STORY_URLS_TOOL_NAME}} tool to get the correct URLs for links to stories.
