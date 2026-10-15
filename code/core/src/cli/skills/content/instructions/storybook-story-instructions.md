# Writing User Interfaces

Use the configured framework (`{{FRAMEWORK}}`) and renderer (`{{RENDERER}}`). Follow the project’s component syntax, story format, imports, and setup conventions. Use examples for this framework when consulting documentation.

When writing UI, prefer breaking larger components up into smaller parts.

ALWAYS write a Storybook story for any component written. If editing a component, ensure appropriate changes have been made to stories for that component. The rules below are for the stories you write; do not rewrite existing stories only to match them.
{{DOCS_WORKFLOW_GUIDANCE}}

## How to write good stories

Goal: Cover every distinct piece of business logic and state the component can reach (happy paths, error/edge states, loading, permissions/roles, empty states, variations from props/context). Avoid redundant stories that show the same logic.

Interactivity: If the component is interactive, add Interaction tests using play functions that drive the UI with storybook/test utilities (e.g., fn, userEvent, expect). Simulate key user flows: clicking buttons/links, typing, focus/blur, keyboard nav, form submit, async responses, toggle/selection changes, pagination/filters, etc. When passing `fn` functions as `args` for callback functions, make sure to add a play function which interacts with the component and assert whether the callback function was actually called.

Data/setup: Provide realistic props, state, and mocked data. Include meaningful labels/text to make behaviors observable. Mock services with deterministic fixtures, as described under Mocking below; keep stories reliable.

Assertions: In play functions, assert the visible outcome of the interaction (text, aria state, enabled/disabled, class/state changes, emitted events). Prefer role/label-based queries.

Variants to consider (pick only those that change behavior): default vs. alternate themes; loading vs. loaded vs. empty vs. error; validated vs. invalid input; permissions/roles/capabilities; feature flags; size/density/layout variants that alter logic.

Accessibility: Use semantic roles/labels; ensure focusable/keyboard interactions are test-covered where relevant.

Naming/structure: Use clear story names that describe the scenario (“Error state after failed submit”). Group related variants logically; don’t duplicate. {{ERROR_EXPORT_RULE}}

Imports/format: Import Meta/StoryObj from the framework package; import test helpers from storybook/test (not @storybook/test). Keep stories minimal—only what's needed to demonstrate behavior.

## Storybook APIs for Story Writing

### Package Consolidation

#### `Meta` and `StoryObj` imports

In the stories you write, import them from the framework package, also when existing stories import them from `{{RENDERER}}`:

```diff
- import { Meta, StoryObj } from '{{RENDERER}}';
+ import { Meta, StoryObj } from '{{FRAMEWORK}}';
```

#### Test utility imports

Import test utilities from `storybook/test`, not `@storybook/test`:

```diff
- import { fn } from '@storybook/test';
+ import { fn } from 'storybook/test';
```

### Global State Changes

The preview annotation for initial global values is `initialGlobals`, not `globals`:

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

### Mocking network requests

{{NETWORK_MOCK_RULE}}

### Mocking imports in Storybook

Mock a module only for a dependency that is not a network call, so stories render consistently.

1. **Register the mock in Storybook's preview file**:
   To mock a module, you MUST register it in `{{PREVIEW_FILE}}`:

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

- **Node.js 22.12+**
- For TypeScript projects, use a version supported by the configured Storybook framework and application framework.
{{RENDERER_REQUIREMENTS}}

## Story Linking Agent Behavior

- After any change to stories files, including existing ones, show the user those stories as described below.
- {{STORY_LINKING_WORKFLOW}}
- {{FINAL_LINKS_GUIDANCE}}
- When you will share preview/story links (i.e. when you are not collapsing everything into a single review section), pass only the most relevant story IDs into **{{PREVIEW_STORIES}}** (generally no more than 5) so the returned URL list stays manageable. Include every URL returned by that call in your final response — do not drop links there.
- {{CHANGED_STORY_FALLBACK_LINK_GUIDANCE}}
- After changing any UI component, find the stories that cover your change and show them to the user as described above, so they can inspect it visually. Do this again for every later change in a session, also for stories you showed before.
