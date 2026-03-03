---
name: builder-bug-workflow
description: Complete workflows for verifying builder bug fixes in code/builders/**. Includes Flow 2 (frontend output) and Flow 3 (terminal output) with sandbox requirements, hash normalization, and snapshot management.
---

# Builder Bug Verification Workflow

When fixing bugs in `code/builders/**`, determine whether the change affects browser-visible output (Flow 2) or Node.js stdout/stderr output (Flow 3), and follow the appropriate workflow.

## Decision: Is this a Browser Output Bug or Terminal Output Bug?

- **Browser output bug** (Flow 2): The fix affects how Storybook renders in the browser (CSS, layout, UI elements, story preview content).
- **Terminal output bug** (Flow 3): The fix affects what is logged to the console during the build or dev process (progress messages, timestamps, paths, diagnostics).

---

# Flow 2 — Builder Bug Verification (Frontend Output)

Follow this workflow if your builder change affects browser-visible output.

## Step 1: Create or Update a Template Story

Create or update a story in the sandbox that demonstrates the affected behaviour and confirms the fix.

For `builder-vite` verification, place the template story in `code/renderers/react/template/stories/` (it will be automatically symlinked into `react-vite-default-ts` at sandbox generation time).

## Step 2: Select the Appropriate Sandbox Template

- **`builder-vite` changes**: Use `react-vite/default-ts`
- **`builder-webpack5` changes**: Use `react-webpack/18-ts`

## Step 3: Generate and Start the Sandbox

Generate the sandbox environment:

```bash
yarn nx sandbox <template> -c production
```

Start the dev server as a background task:

```bash
cd ../storybook-sandboxes/<sandbox-dir> && yarn storybook --ci
```

- **Startup time**: The sandbox dev server typically takes **30–90 seconds** on first cold start; wait for the console to emit `"Storybook X.Y started"` before opening the browser.
- **Known failure — port in use**: If port 6006 is occupied, kill the incumbent process:
  ```bash
  lsof -ti :6006 | xargs kill -9
  ```
  Then retry the dev server start.

Wait for the port to be ready (check console for "Storybook started").

## Step 4: Capture Visual Evidence

Use the Browser MCP to:

1. Open the Storybook instance
2. Navigate to your template story
3. Take a screenshot showing the fix works correctly

### Save Screenshot to Verification Folder

After taking the screenshot, move it to the repository's verification folder:

```bash
# Create the verification folder structure if it doesn't exist
mkdir -p verification/screenshots/flow-2/issue-$ARGUMENTS[0]

# Move/copy your screenshot from /tmp or temp location
cp /tmp/screenshot-*.png verification/screenshots/flow-2/issue-$ARGUMENTS[0]/

# Verify files are in place
ls -la verification/screenshots/flow-2/issue-$ARGUMENTS[0]/
```

**Success Criteria**:

- [ ] Screenshots saved to `verification/screenshots/flow-2/issue-$ARGUMENTS[0]/`
- [ ] Files are named descriptively (e.g., `before-fix.png`, `after-fix.png`)
- [ ] Ready to be committed with git

## Step 5: Fallback Path (if bug persists)

If the browser output still shows the bug:

1. Kill the dev server
2. Recompile: `yarn nx compile <package-name> -c production`
3. Copy fresh `dist/` into the sandbox:
   - Source: `code/<package-path>/dist/`
   - Destination: `../storybook-sandboxes/<sandbox-dir>/node_modules/@storybook/<package-name>/dist/`
4. Restart the dev server: `cd ../storybook-sandboxes/<sandbox-dir> && yarn storybook --ci`
5. Re-verify with a new screenshot

---

# Flow 3 — Builder Bug Verification (Terminal Output)

Follow this workflow if your builder change affects Node.js stdout/stderr output (console logs, build progress, error messages, etc.).

## Step 1: Verify Sandbox Availability

The terminal output capture requires the sandbox directory to exist for your builder:

- **`builder-vite`**: Requires `../storybook-sandboxes/react-vite-default-ts`
- **`builder-webpack5`**: Requires `../storybook-sandboxes/react-webpack-18-ts`

If either directory is missing, generate it:

```bash
yarn nx sandbox <template> -c production
```

## Step 2: Run the Capture Script

Run the terminal output capture and comparison:

```bash
jiti scripts/capture-terminal-output.ts --builder <builder-name>
```

The output is compared against `scripts/terminal-output-snapshots/<builder-name>-build.snap.txt`.

## Step 3: Review and Commit the Baseline

**Decision: Create or Update?**

- **No baseline exists** (you have never run this before for this builder): You must **create** a baseline by running `--update`
- **Baseline exists** but needs updating due to your fix: You **update** the baseline
- **Baseline exists** but output doesn't match your fix: Your fix may be incomplete—re-run Step 1-2

**If no baseline exists** (all snapshots start as placeholders):

- Run: `jiti scripts/capture-terminal-output.ts --builder <builder-name> --update`
- This creates a "PROVISIONAL BASELINE" snapshot requiring reviewer approval
- Add a note to your PR description: `<!-- PROVISIONAL BASELINE — requires reviewer approval before merge -->`

**If the diff is consistent with your fix**:

- Review the diff output carefully to confirm it shows only expected changes:
  - Build structure changes (new assets, removed files, reorganized chunks)
  - Performance metrics (durations, file sizes)
  - Build messages or progress indicators
  - **NOT** due to asset filename hashes (these are auto-normalized to `<HASH>`)
- Run: `jiti scripts/capture-terminal-output.ts --builder <builder-name> --update` to commit the new baseline
- Summarize the changes in your PR description

## Step 4: Understand Hash Normalization

Build tools generate content hashes in filenames to enable long-term caching. These hashes change whenever file content changes. To keep snapshots stable and focused on structural changes, the capture script automatically normalizes hashes:

- **Original output**: `context-C0qIqeS4.png`, `formatter-ABCDEF-GHIJKL.js`, `ts-argtypes-BOocmtEy.css`
- **Normalized snapshot**: `context-<HASH>.png`, `formatter-<HASH>.js`, `ts-argtypes-<HASH>.css`

**Validation checklist**:

- ✓ All asset filenames (`/assets/*.ext`) show `<HASH>` placeholders, not real hashes
- ✓ Version numbers like `v10.3.0-alpha.12` are preserved (not normalized)
- ✓ Build messages and paths are normalized where present

## Step 5: Handle Noisy or Unexpected Diffs

If the diff is large or unexpected:

1. Diagnose what output changed and why
2. Verify the changes are a direct result of your builder modification
3. Iterate on your fix until the diff is clean and focused
4. Run the capture script again: `jiti scripts/capture-terminal-output.ts --builder <builder-name>`

## Step 6: Commit and Open PR

- Commit the updated snapshot file
- Include a summary of what terminal output changed in the PR description
- Explain the business impact of the changes (performance, clarity, new features, etc.)
