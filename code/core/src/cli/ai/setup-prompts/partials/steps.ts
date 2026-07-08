import { dedent } from 'ts-dedent';
import {
  getMswInitCommand,
  getVitestStorybookRunCommand,
} from '../../../../common/js-package-manager/util.ts';
import type { SetupInstructionsContext as InstructionsContext, ProjectInfo } from '../../types.ts';
import {
  getInteractionPlayExample,
  getMainConfigExample,
  getPortalDecoratorExample,
  getPreviewExample,
  getStoryExample,
} from './examples.ts';

export function discoveryStepStrict(
  projectInfo: ProjectInfo,
  { tsx }: InstructionsContext
): { title: string; body: string } {
  return {
    title: 'Discover the runtime (≤12 reads)',
    body: dedent`
      Identify, in this order, using Glob/Grep first then targeted Reads:

    - \`index.html\` — \`<link rel="stylesheet">\` tags, inline \`<style>\` blocks, fonts, and any \`<div id="...">\` mount or portal roots that aren't created by JS
    - entry file (\`main.${tsx}\` / \`index.${tsx}\`) — providers wrapping \`<App />\`, root CSS imports
    - \`App.${tsx}\` — top-level layout, router usage, providers it consumes
    - providers / context files — what they expose
    - root CSS — global styles, CSS variables, theme tokens (both JS-imported CSS **and** anything linked from \`index.html\`)
    - data hooks — \`fetch(...)\`, \`useQuery\`, \`axios\`, etc. (capture base URL + endpoints actually called during render)
    - browser state actually read at render — \`localStorage\`/\`sessionStorage\`/cookie keys
    - portal targets — \`createPortal(...)\` and the DOM ids it mounts to (e.g. \`#modal-root\`)
    - 1–2 real page or feature components (your story source-of-truth for JSX patterns)

    Stop reading once you can answer: *"What providers, CSS, browser state, and network calls must the preview supply for a typical page to render?"*
  `,
  };
}

export function discoveryStepRelaxed(
  projectInfo: ProjectInfo,
  { tsx }: InstructionsContext
): { title: string; body: string } {
  return {
    title: 'Discover the runtime (≤40 reads)',
    body: dedent`
      Identify, in this order, using Glob/Grep first then targeted Reads:

    - \`index.html\` — \`<link rel="stylesheet">\` tags, inline \`<style>\` blocks, fonts, and any \`<div id="...">\` mount or portal roots that aren't created by JS
    - entry file (\`main.${tsx}\` / \`index.${tsx}\`) — providers wrapping \`<App />\`, root CSS imports
    - \`App.${tsx}\` — top-level layout, router usage, providers it consumes
    - providers / context files — what they expose
    - root CSS — global styles, CSS variables, theme tokens (both JS-imported CSS **and** anything linked from \`index.html\`)
    - data hooks — \`fetch(...)\`, \`useQuery\`, \`axios\`, etc. (capture base URL + endpoints actually called during render)
    - browser state actually read at render — \`localStorage\`/\`sessionStorage\`/cookie keys
    - portal targets — \`createPortal(...)\` and the DOM ids it mounts to (e.g. \`#modal-root\`)
    - 1–20 real page or feature components (your story source-of-truth for JSX patterns)

    Stop reading once you can answer: *"What providers, CSS, browser state, and network calls must the preview supply for a typical page to render? What surrounding context do components need to render?"*
  `,
  };
}

export function verifyStep(
  projectInfo: ProjectInfo,
  { packageManager, tsx }: InstructionsContext
): { title: string; body: string } {
  const vitestRunAll = getVitestStorybookRunCommand(packageManager);
  const vitestRunFile = getVitestStorybookRunCommand(packageManager, `path/to/Foo.stories.${tsx}`);

  return {
    title: `Verify in one batch, then iterate only on failures`,
    body: dedent`**Read this rule once before running anything:** the first vitest invocation must run **all** the new stories together. No single-file runs before the batch.

    \`\`\`bash
    ${vitestRunAll}
    \`\`\`

    Then run the project's TypeScript check (use the script from \`package.json\` — typically \`tsc --noEmit\` or \`${packageManager.getRunCommand('typecheck')}\`). Read the raw output once; don't pipe it through repeated \`grep\`/\`head\` invocations to slice it.

    For each failure:

    1. Read the error.
    2. If multiple stories share the failure, fix the shared preview setup, not the stories.
    3. Re-run vitest **only for the affected file(s)**: \`${vitestRunFile}\`.
    4. Repeat until the file passes, then move on. Cap retries at ~5 per file — if it still fails, leave \`'needs-work'\` tag to inform the user.
    5. When you keep failing on a story, play function, etc., do not substitute it for easier content that contributes less to codebase understanding.

    **After a file passes**, edit its meta and remove \`'needs-work'\` so its tags become \`['ai-generated']\`. Files you couldn't fix keep \`['ai-generated', 'needs-work']\` — move on, don't loop forever.`,
  };
}

export function verifyWithAllowedFailureStep(
  projectInfo: ProjectInfo,
  { packageManager, tsx }: InstructionsContext
): { title: string; body: string } {
  const vitestRunAll = getVitestStorybookRunCommand(packageManager);
  const vitestRunFile = getVitestStorybookRunCommand(packageManager, `path/to/Foo.stories.${tsx}`);

  return {
    title: `Verify in one batch, then iterate only on failures`,
    body: dedent`**Read this rule once before running anything:** the first vitest invocation must run **all** the new stories together. No single-file runs before the batch.

    \`\`\`bash
    ${vitestRunAll}
    \`\`\`

    Then run the project's TypeScript check (use the script from \`package.json\` — typically \`tsc --noEmit\` or \`${packageManager.getRunCommand('typecheck')}\`). Read the raw output once; don't pipe it through repeated \`grep\`/\`head\` invocations to slice it.

    For each failure:

    1. Read the error.
    2. If multiple stories share the failure, fix the shared preview setup, not the stories.
    3. In subsequent runs, re-run Vitest **only for the affected file(s)**: \`${vitestRunFile}\`.
    4. Fix any TypeScript issues needed for story files to pass, then re-run TS and Vitest only for those files. Repeat until files pass, or until you have tried 5 times.
    5. If a story file still fails after those retries, leave the file tagged \`'needs-work'\` and move on — do not keep chasing project-wide TS errors caused by preserved \`'needs-work'\` files.
    6. When you keep failing on a story, play function, etc., do not substitute it for easier content that contributes less to codebase understanding.
    **After a file passes**, edit its meta and remove \`'needs-work'\` so its tags become \`['ai-generated']\`. Files you couldn't fix keep \`['ai-generated', 'needs-work']\` — move on, don't loop forever.`,
  };
}

export function cleanupStep(
  { needsUserOnboarding }: ProjectInfo,
  ctx: InstructionsContext
): { title: string; body: string } {
  const onboardingInstructions = needsUserOnboarding
    ? 'You must preserve the components, CSS, stories and MDX docs initially created by Storybook, as they are required for user onboarding in the UI.'
    : 'Delete the components, CSS, stories and MDX docs initially created by Storybook only if you managed to write successful stories.';

  return {
    title: `Clean up`,
    body: `Before finishing, remove debug code, broad mocks added during diagnosis, unused deps, and eval artifacts. ${onboardingInstructions}`,
  };
}

export function monorepoStep(
  projectInfo: ProjectInfo,
  ctx: InstructionsContext
): { title: string; body: string } {
  return {
    title: 'Monorepo preparation',
    body: dedent`Build any local monorepo dependencies identified during discovery, and keep track of existing errors in the codebase unrelated to the package changes you'll make.`,
  };
}

export function buildSharedPreviewStep(
  projectInfo: ProjectInfo,
  { configDir, tsx }: InstructionsContext
): { title: string; body: string } {
  return {
    title: 'Build the shared preview',
    body: dedent`    Set up Storybook **once** so most stories work without per-story setup. **Edit the existing \`${configDir}/preview.${tsx}\`** (created by \`storybook init\`) — add to its existing config object, don't replace it.

    The complete shape should look like this (merge the new pieces into what's already there):

    ${getPreviewExample(projectInfo)}

    Rules for the preview:

    - Use the **real** provider tree and the **real** root CSS import. Don't invent providers.
    - If the app's CSS is loaded via \`<link>\` in \`index.html\` (rather than imported in JS), import the same file from preview so stories render with the same styles.
    - Seed only the specific browser-state keys the app actually reads. Do **not** clear all of \`localStorage\`/\`sessionStorage\`/cookies, and do not reset Storybook's own state.
    - Use \`mockdate\` only when render output depends on the date.
    - Do not mock \`window\`, \`document\`, \`navigator\`, observers, or \`fetch\` directly.
    `,
  };
}

export function buildPortalStep(
  projectInfo: ProjectInfo,
  { configDir, tsx }: { configDir: string; tsx: string }
): { title: string; body: string } {
  return {
    title: 'Portals (in a decorator, not \`preview-body.html\`)',
    body: dedent`If you found \`createPortal(..., document.getElementById('foo'))\` in discovery, **add a decorator in \`${configDir}/preview.${tsx}\` that creates the portal root** before the story renders. Do not use \`preview-body.html\`.

    ${getPortalDecoratorExample(projectInfo)}

    Add this decorator to the \`decorators\` array of your preview config. Skip this step entirely if portals only target \`document.body\`.`,
  };
}

export function mswStep(
  projectInfo: ProjectInfo,
  { configDir, mswInstall, packageManager, ts }: InstructionsContext
): { title: string; body: string } {
  const mswInit = getMswInitCommand(packageManager);

  return {
    title: 'MSW handlers (only what stories will hit)',
    body: `Use \`msw-storybook-addon\`. Install with:

    \`\`\`bash
    ${mswInstall}
    ${mswInit}
    \`\`\`

    Make sure \`${configDir}/main.${ts}\` serves \`./public\`:

    ${getMainConfigExample(projectInfo)}

    Put handlers in \`${configDir}/msw-handlers.${ts}\`. Cover only the endpoints your stories will exercise — no catch-alls.

    \`\`\`${ts}
    // ${configDir}/msw-handlers.${ts}
    import { http, HttpResponse } from 'msw';

    export const mswHandlers = {
      products: [
        http.get('https://api.example.com/products', () =>
          HttpResponse.json({ items: [{ id: 'p1', name: 'Example', price: 42 }] })
        ),
      ],
    };
    \`\`\`
`,
  };
}

export function writeStoriesStep(
  projectInfo: ProjectInfo,
  { tsx }: InstructionsContext
): { title: string; body: string } {
  return {
    title: 'Write up to 10 story files (in one batch)',
    body: dedent`

    This step has **two required deliverables**:

    a. Up to 10 colocated \`*.stories.${tsx}\` files for meaningful targets in the codebase.
    b. **Exactly one \`CssCheck\` story** added to one of those files (spec below). This step is not complete without it.

    **Substep a — pick targets and write the files.** Pick ~10 meaningful targets from the real codebase (low-level reusable → page components). Skip subcomponents, hooks, contexts, helpers, and \`App\` itself when real page components exist.

    Each story file: ~3 exports for typical components, up to ~10 when warranted by real usage. Copy JSX patterns from real pages/routes/tests.

    **Tag every new story file with \`['ai-generated', 'needs-work']\` from the start.** You will remove \`'needs-work'\` only after vitest confirms the file passes. This way, anything not yet verified — including stories you ran out of time to fix — stays correctly marked.

    ${getStoryExample(projectInfo)}

    Story rules:

    - Start every meta with \`tags: ['ai-generated', 'needs-work']\`.
    - Show all imports explicitly.
    - Don't add a custom \`title\`.
    - Don't build large story-specific harnesses — fix preview instead.
    - Don't create new app components.

    **Substep b — add the single \`CssCheck\` story.** Before you finish this step, pick **one** visually distinctive component from the files you just wrote and add a \`CssCheck\` export to that file. Exactly **one** \`CssCheck\` across the whole project — not one per file. This step is not complete until the story exists.

    Why it's mandatory: \`toBeVisible\` passes on an unstyled component. A concrete \`getComputedStyle\` value is the only proof that the shared preview actually loaded the app's CSS — without it, you have no idea whether your stories are rendering correctly.

    How: read a real styling value from the component's source (e.g. a hex color in styled-components, a Tailwind class like \`bg-blue-600\`, a CSS variable from the theme), and assert the resolved \`getComputedStyle\` value:

    \`\`\`${tsx}
    export const CssCheck: Story = {
      args: { children: 'Submit' },
      play: async ({ canvas }) => {
        const button = canvas.getByRole('button', { name: /submit/i });
        // PrimaryButton uses bg-blue-600 — fails if Tailwind / global CSS did not load.
        await expect(getComputedStyle(button).backgroundColor).toBe('rgb(37, 99, 235)');
      },
    };
    \`\`\`
    `,
  };
}

export function writeStoriesWithAllowedFailuresStep(
  projectInfo: ProjectInfo,
  { tsx }: InstructionsContext
): { title: string; body: string } {
  return {
    title: 'Write up to 10 story files (in one batch)',
    body: dedent`

    This step has **two required deliverables**:

    a. Up to 10 colocated \`*.stories.${tsx}\` files for meaningful targets in the codebase.
    b. **Exactly one \`CssCheck\` story** added to one of those files (spec below). This step is not complete without it.

    **Substep a — pick targets and write the files.** Pick ~10 meaningful targets from the real codebase (low-level reusable → page components). Skip subcomponents, hooks, contexts, helpers, and \`App\` itself when real page components exist.

    Each story file: ~3 exports for typical components, up to ~10 when warranted by real usage. Copy JSX patterns from real pages/routes/tests.

    **Tag every new story file with \`['ai-generated', 'needs-work']\` from the start.** You will remove \`'needs-work'\` only after vitest confirms the file passes, and you will leave the tag if the file is not fully functional at the end of your self-healing loop.

    ${getStoryExample(projectInfo)}

    Story rules:

    - Start every meta with \`tags: ['ai-generated', 'needs-work']\`.
    - Show all imports explicitly.
    - Don't add a custom \`title\`.
    - Don't build large story-specific harnesses — fix preview instead.
    - Don't create new app components.

    **Substep b — add the single \`CssCheck\` story.** Before you finish this step, pick **one** visually distinctive component from the files you just wrote and add a \`CssCheck\` export to that file. Exactly **one** \`CssCheck\` across the whole project — not one per file. This step is not complete until the story exists.

    Why it's mandatory: \`toBeVisible\` passes on an unstyled component. A concrete \`getComputedStyle\` value is the only proof that the shared preview actually loaded the app's CSS — without it, you have no idea whether your stories are rendering correctly.

    How: read a real styling value from the component's source (e.g. a hex color in styled-components, a Tailwind class like \`bg-blue-600\`, a CSS variable from the theme), and assert the resolved \`getComputedStyle\` value:

    \`\`\`${tsx}
    export const CssCheck: Story = {
      args: { children: 'Submit' },
      play: async ({ canvas }) => {
        const button = canvas.getByRole('button', { name: /submit/i });
        // PrimaryButton uses bg-blue-600 — fails if Tailwind / global CSS did not load.
        await expect(getComputedStyle(button).backgroundColor).toBe('rgb(37, 99, 235)');
      },
    };
    \`\`\`
    `,
  };
}

export function interactionPlayStep(
  projectInfo: ProjectInfo,
  { tsx }: InstructionsContext
): { title: string; body: string } {
  return {
    title: `Add \`play\` functions only where they prove something non-trivial`,
    body: dedent`
    **Do not put a \`play\` on every story.** A \`play\` is worth writing only when it asserts something the rendered output alone doesn't already prove. Prefer one good \`play\` per file over five redundant ones.

    Write a \`play\` when it can verify:

    - an **interaction** (form fill + submit, click → menu opens, tab change reveals panel)
    - **async data** actually arrived from MSW (waiting for mocked content to replace a spinner)
    - a **portal** rendered into the right root (query via \`canvasElement.ownerDocument\`)
    - a **CSS-driven state** that matters semantically (e.g. theme color, disabled styling, layout that confirms the global stylesheet loaded)
    - **accessibility** that the component is responsible for (correct role/label exposure)

    **Skip \`play\` entirely** when a story is just a static variant of the same component (different \`args\`, no new behavior). Repeating \`getByRole(...).toBeVisible()\` across \`Clear\`, \`Large\`, \`WithIcon\` etc. is redundant — the render itself already fails the test if the component throws or doesn't mount.

    **Smoke plays must prove something the render alone doesn't.** A play that does only \`await expect(canvas.getByRole('button')).toBeVisible()\` adds nothing — the render already failed if the button didn't mount. Acceptable smoke plays assert one of:

    - an **aria attribute reflecting state** (\`aria-expanded\`, \`aria-disabled\`, \`aria-checked\`, \`aria-current\`)
    - a **prop value rendered as text or attribute** (e.g. \`args.label\` appears in the DOM, \`href\` matches \`args.to\`)
    - **async content arriving** (\`findBy*\`, \`waitFor\` — proves the loader/MSW handler actually resolved)
    - a **portal mounting in the right root** (queried via \`canvasElement.ownerDocument.body\`)

    If none of those apply, skip the \`play\` and rely on the render itself.

    Concretely, in a \`Button.stories.${tsx}\` with \`Primary\`, \`Clear\`, \`Large\`, \`WithIcon\`:

    - \`Primary\` — keep one smoke \`play\` (one is enough for the file).
    - \`Clear\`, \`Large\`, \`WithIcon\` — **no \`play\`**. They're variant-only stories.

    (The single \`CssCheck\` story for the whole project was added in Step 5 — don't add another one here.)

    Imports & play context — get this right or vitest will fail in subtle ways:

    - \`expect\` and \`waitFor\` come from \`'storybook/test'\` — import those.
    - \`canvas\`, \`userEvent\`, and \`canvasElement\` come from the **play arguments**: \`async ({ canvas, userEvent, canvasElement }) => { ... }\`. **Do not** \`import { userEvent } from 'storybook/test'\` and **do not** write \`const canvas = within(canvasElement)\` — both are already provided.
    - For **portal queries only**, query via \`canvasElement.ownerDocument.body\`. You may import \`within\` from \`'storybook/test'\` for that case (e.g. \`within(canvasElement.ownerDocument.body).findByTestId(...)\`). Don't use \`within\` for anything else.

    ${getInteractionPlayExample(projectInfo)}`,
  };
}
