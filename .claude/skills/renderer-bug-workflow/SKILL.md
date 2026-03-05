---
name: renderer-bug-workflow
description: Complete workflow for verifying renderer bug fixes in code/renderers/**. Includes template story creation, sandbox generation, visual verification, and fallback procedures.
---

# Renderer Bug Verification Workflow (Flow 1)

When fixing bugs in `code/renderers/**`, follow this workflow to verify the fix with visual evidence.

## Step 1: Create or Update a Template Story

Create or update a story in the affected renderer's template stories directory that demonstrates the bug and confirms the fix:

- **Location**: `code/renderers/<renderer>/template/stories/`
- The story should clearly exercise the broken behaviour and show that it is resolved.

**Reference example**: See `code/renderers/react/template/stories/copilot-verification-example.stories.tsx` for a minimal example of what a template story should look like for Copilot verification purposes.

## Step 2: Select a Sandbox Template

Heuristically select the most relevant sandbox template based on the renderer type and bug context:

- **React**: `react-vite/default-ts`
- **Vue 3**: `vue3-vite/default-ts`
- **Svelte**: `svelte-vite/default-ts`
- **HTML**: `html-vite/default-ts`
- **Preact**: `preact-vite/default-ts`
- **Web Components**: `web-components-vite/default-ts`

If the renderer is not listed, choose based on the context of the bug and the primary framework that uses the renderer.

## Step 3: Generate the Sandbox

Generate the sandbox environment:

```bash
yarn nx sandbox <template> -c production
```

This creates a new sandbox at `../storybook-sandboxes/<sandbox-dir>/`

## Step 4: Start the Dev Server

In a background terminal session, start the sandbox dev server and wait for it to be ready:

```bash
cd ../storybook-sandboxes/<sandbox-dir> && yarn storybook --ci
```

### Important Notes

- **Startup time**: The sandbox dev server typically takes **30–90 seconds** on first cold start; wait for the console to emit `"Storybook X.Y started"` before opening the browser.
- **Known failure — port in use**: If port 6006 is occupied, kill the incumbent process:
  ```bash
  lsof -ti :6006 | xargs kill -9
  ```
  Then retry starting the dev server.

Check the console output for "Storybook started" or similar confirmation before proceeding.

## Step 5: Capture Visual Evidence

Use the Browser MCP to:

1. Open the running Storybook instance
2. Navigate to your template story
3. Take a screenshot showing the fix is working

**What a "passing" screenshot shows**:

- ✅ The previously broken behavior is now fixed
- ✅ The story renders without errors or warnings
- ✅ Visual output matches expected behavior described in the issue

If the bug is resolved in the screenshot, save it locally (e.g., in a temp folder). It will be uploaded directly into the PR description — do **not** commit it to the repository.

**Evidence quality checklist**:

- [ ] Screenshot clearly shows the story/component rendering
- [ ] The fixed behavior is visually distinct from what the bug report showed
- [ ] No error messages or stack traces in the DevTools console
- [ ] The screenshot is clear enough for reviewers to verify the fix

### Story URL Pattern

The story URL follows the pattern `http://localhost:6006/?path=/story/<id>` where `<id>` comes from Storybook's title calculation logic — **do not guess it**. Instead, look it up:

```bash
.claude/scripts/find-story.sh "your-fragment"
# Output: id | title | name | exportName | importPath
```

Use the `id` field in the URL. See `.claude/scripts/find-story.sh` for full usage (`--port` option, no-fragment to list all).

## Step 6: Fallback Path (if bug persists)

If the story still shows the bug after initial verification:

1. Kill the dev server
2. Recompile the affected package: `yarn nx compile <package-name> -c production`
3. Copy the fresh `dist/` from the compiled package into the sandbox:
   - Source: `code/<package-path>/dist/`
   - Destination: `../storybook-sandboxes/<sandbox-dir>/node_modules/@storybook/<package-name>/dist/`
4. Restart the dev server: `cd ../storybook-sandboxes/<sandbox-dir> && yarn storybook --ci`
5. Re-verify the fix with a new screenshot

## Multi-Scenario PRs

For PRs that fix multiple distinct scenarios:

- Use one primary template
- Include one screenshot per distinct scenario type
- Ensure each screenshot clearly demonstrates the fix for that specific scenario

---

✅ **COMPLETE** — Template story created, before/after screenshots captured locally. Return to `/implement-and-verify-fix` Step 6 to commit the story file and prepare screenshots for the PR body.
