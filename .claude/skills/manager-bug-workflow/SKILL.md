---
name: manager-bug-workflow
description: Complete workflow for verifying Manager UI bug fixes in code/core/src/manager/** or code/core/src/builder-manager/**. Includes E2E test creation, Playwright configuration, and browser verification.
---

# Manager Bug Verification Workflow (Flow 4)

When fixing bugs in `code/core/src/manager/**`, `code/core/src/builder-manager/**`, or any code that manifests as a bug in the Storybook Manager UI (Controls panel, sidebar, addon panels, etc.), follow this workflow to verify the fix with both automated E2E tests and visual evidence.

---

## Step 1: Decide Whether You Need a New Story

E2E tests run against the **internal Storybook UI** served from `code/` on port 6006. Before writing a test, check if an existing story already demonstrates the affected behavior:

```bash
# Search for existing stories related to the affected area
grep -r "your-keyword" code/e2e-tests/ --include="*.spec.ts"
```

**Existing useful story paths** (for Controls-panel related tests):

- `example-button--primary` → `code/addons/onboarding/example-stories/Button.stories.tsx`
- `core-controls-basics--defined` → `code/core/template/stories/controls/basics.stories.ts`
- `core-controls-basics--undefined` → same file

If no existing story covers the scenario, proceed to Step 1a. Otherwise skip to Step 2.

---

### Step 1a: Create a Test Story (if needed)

The internal Storybook includes several story directories. Add your story to whichever directory fits the subject area:

| Directory                                 | Title Prefix                   | Good for                   |
| ----------------------------------------- | ------------------------------ | -------------------------- |
| `code/core/src/controls/components/`      | `controls/`                    | Controls panel behavior    |
| `code/core/template/stories/controls/`    | `core/controls/`               | Generic controls scenarios |
| `code/addons/docs/src/blocks/controls/`   | `addons/docs/blocks/controls/` | ObjectControl, etc.        |
| `code/addons/onboarding/example-stories/` | `Example/`                     | General button/UI examples |

**Story ID format** (needed for the E2E test URL):

```
{title-prefix}-{story-title}--{export-name}
```

All parts are lowercased and kebab-cased. Example:

- File: `code/core/src/controls/components/FunctionArgPreservation.stories.tsx`
- `title: 'controls/function-arg-preservation'`
- Export: `ObjectWithFunction`
- **Story ID**: `controls-function-arg-preservation--object-with-function`
- **URL**: `/?path=/story/controls-function-arg-preservation--object-with-function`

**Example story for a Controls panel bug involving an object arg with a function:**

```tsx
import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

function ButtonWithObjectProps({
  buttonProps,
}: {
  buttonProps: { label: string; onClick: () => void };
}) {
  return <button onClick={buttonProps.onClick}>{buttonProps.label}</button>;
}

const meta = {
  title: 'controls/function-arg-preservation',
  component: ButtonWithObjectProps,
} satisfies Meta<typeof ButtonWithObjectProps>;

export default meta;

export const ObjectWithFunction: StoryObj<typeof meta> = {
  args: {
    buttonProps: {
      label: 'Click me',
      onClick: fn().mockName('onClick'), // mockName controls Actions panel label
    },
  },
};
```

**Key patterns for test stories:**

- Use `fn().mockName('myName')` for function args — this controls the label shown in the Actions panel
- For object args with functions, `fn()` nested inside the object is correctly tracked by Storybook's Actions addon
- Keep the component minimal — it just needs to make the affected behavior observable
- **For Controls panel argType rows**: an argType only appears in the Controls panel if it has a corresponding `args` value AND a `control` type (e.g. `control: 'text'`). Setting only `table.type.detail` is not enough — the row won't render.

---

## Step 2: Write the E2E Test

Add your test inside the `Desktop` describe block in `code/e2e-tests/manager.spec.ts`.

**Important**: Always use `sbPage.navigateToStory(title, storyName)` to navigate to a story — it waits for the sidebar selection, URL change, and full story load. Do NOT use `page.goto()` + `waitUntilLoaded()` for story navigation; it has race conditions and the session storage init script won't apply retroactively.

**Finding the correct `title` and `name` to pass**: Do not guess from the file path. Look up the story in the live index:

```bash
.claude/scripts/find-story.sh "your-fragment"
# Output: id | title | name | exportName | importPath
# Use `title` as the first arg and `name` as the second arg to navigateToStory
```

**Pattern for Controls panel tests:**

```ts
test('Controls panel preserves X when Y', async ({ page }) => {
  const sbPage = new SbPage(page, expect);

  // Navigate via sidebar — most reliable method
  await sbPage.navigateToStory('controls/function-arg-preservation', 'Object With Function');

  // Verify initial state
  const button = sbPage.previewRoot().getByRole('button');
  await expect(button).toContainText('Click me');

  // Interact with Controls panel
  await sbPage.viewAddonPanel('Controls');
  // Switch object control to raw JSON editing mode
  await sbPage.panelContent().locator('[aria-label="Edit buttonProps as JSON"]').click();
  const textarea = sbPage.panelContent().locator('#control-buttonProps');
  await textarea.fill('{"label":"Updated label"}');
  await textarea.blur();

  // Verify the change was applied in the preview
  await expect(button).toContainText('Updated label');

  // Verify function args are still called (key assertion for issue #33802-style bugs)
  await sbPage.viewAddonPanel('Actions');
  await button.click();
  await expect(sbPage.panelContent().locator('span', { hasText: 'onClick:' })).toBeVisible();
});
```

**Useful SbPage helpers:**

- `sbPage.previewRoot()` — the story preview frame locator
- `sbPage.panelContent()` — the active addon panel tab content
- `sbPage.viewAddonPanel('Controls')` — switch to Controls tab
- `sbPage.viewAddonPanel('Actions')` — switch to Actions tab

**Object control locators:**

- Raw JSON edit button: `[aria-label="Edit {argName} as JSON"]`
- Raw JSON textarea: `#control-{argName}` (e.g. `#control-buttonProps`)
- After editing, **blur** the textarea (not Enter) to trigger the update

**Reference example**: `code/e2e-tests/manager.spec.ts` — the `'Copilot verification example — Manager UI smoke test'` test inside the Desktop describe block is the minimal starting point.

---

## Step 3: Start the Dev Server

⚠️ **Do NOT run `storybook:ui:build` before running E2E tests.** The build creates a static snapshot that does NOT include newly created story files unless you rebuild. Use the dev server instead — it serves from source and picks up new files automatically.

Start the dev server as a background process:

```bash
cd code && yarn storybook:ui --ci &
```

This starts a **dev server** on port **6006** with hot reload. Wait ~10 seconds then verify it's up:

```bash
curl -s http://localhost:6006 -o /dev/null -w "%{http_code}"  # should print 200
```

If you created a new story file in Step 1a, the dev server will include it on first load — no rebuild needed.

---

## Step 4: Capture Visual Evidence

Use the Browser MCP to:

1. Open `http://localhost:6006/?path=/story/{your-story-id}`
2. Interact with the affected area of the Manager UI (Controls panel, sidebar, etc.)
3. Take a screenshot (ideally by using ChromeDev MCP) showing the fix works correctly

**What a "passing" screenshot shows**:

- ✅ The Manager UI feature (Controls, Actions, sidebar, etc.) is functioning as expected
- ✅ The previously broken behavior is now fixed and visually evident
- ✅ Interactive elements respond correctly to user actions
- ✅ No error messages or console errors visible

Save the screenshot locally. It will be uploaded directly into the PR description — do **not** commit it to the repository.

**Evidence quality checklist**:

- [ ] Screenshot shows the Manager UI with the affected panel/feature
- [ ] The fixed behavior is visually distinct from what the issue described as broken
- [ ] Interactive state demonstrates the fix (e.g., function called, control updated, panel rendered)
- [ ] DevTools console is clean (no errors related to the fix)
- [ ] The screenshot clearly shows the fix working

---

## Step 5: Run the E2E Suite

```bash
cd code && STORYBOOK_URL=http://localhost:6006 yarn playwright test e2e-tests/manager.spec.ts
```

**`STORYBOOK_URL=http://localhost:6006` is required** — the Playwright config defaults to port 8001.

To run only your new test during development:

```bash
cd code && STORYBOOK_URL=http://localhost:6006 yarn playwright test e2e-tests/manager.spec.ts --grep "your test name"
```

---

## Step 6: Confirm Test Passes

Ensure that:

- Your new or updated test passes
- All other Manager E2E tests continue to pass
- No test timeouts or failures occur

If the test fails with "Storybook iframe did not have children", it means the story URL is wrong or the story wasn't picked up. Check:

1. The story ID in the URL is correct (derive it from title prefix + story title + export name, all lowercased kebab-case)
2. The dev server is running and the story is visible at `http://localhost:6006/?path=/story/{id}`
3. If you created the story after the build (not the dev server), restart using the dev server

**Debugging a failing test without screenshots**: When a test fails, Playwright writes `playwright-results/*/error-context.md` containing a full ARIA snapshot of the page at the point of failure. Read this file first — it shows exactly what elements are visible, their roles, and accessible names, without needing to open the trace viewer.

**React-aria popover/dialog accessible name**: React-aria's `DialogTrigger`/`Popover` derives the dialog's accessible name from the trigger button label (via `aria-labelledby`), not from any `aria-label` prop passed to the popover container. When asserting `getByRole('dialog', { name: '...' })` for a `PopoverProvider`-based popover, use the trigger button's visible text as the name.

---

✅ **Flow 4 COMPLETE** — E2E test passing, before/after screenshots captured locally. Return to `/implement-and-verify-fix` Step 6 to commit the E2E test file and prepare screenshots for the PR body.
