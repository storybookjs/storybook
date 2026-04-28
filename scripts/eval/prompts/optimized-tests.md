# Storybook Setup

## Project Info

| Property | Value |
|----------|-------|
| Version | 10.4.0-alpha.10 |
| Renderer | @storybook/react |
| Framework | @storybook/react-vite |
| Builder | @storybook/builder-vite |
| Config Dir | `.storybook` |
| Language | TypeScript |
| Package Manager | yarn |
| Addons | @storybook/addon-onboarding, @storybook/addon-themes, @storybook/addon-docs, @storybook/addon-designs, @storybook/addon-vitest, @storybook/addon-a11y, storybook-addon-pseudo-states, @chromatic-com/storybook |

Your goal is to make Storybook fully functional in this project: configure `.storybook/preview.tsx` with the right decorators, add MSW for data, and write up to 10 colocated `*.stories.tsx` files. Add `play` functions only where they prove something non-trivial.

## Rules of engagement (follow strictly — these are time budgets, not suggestions)

1. **Discover with Glob/Grep/Read, not shell.** Never use `ls`, `find`, `cat`, `head`, `tail`, shell `grep`, `sed`, or `node -e` for discovery or for editing files in bulk — these are slower per call and violate caching. Concrete substitutions, no exceptions:
    - List a directory → `Glob('src/components/*')`, not `ls src/components`.
    - Search a string → `Grep('pattern', { path: 'src' })`, not `grep -rn ...` or `find ... | xargs grep`.
    - Read a file → `Read('path/to/file')`, not `cat`/`head`/`tail`.
    - Bulk-edit many files → multiple `Edit` calls (or `Edit` with `replace_all`), not `sed -i`.
2. **Never read or grep inside `node_modules`.** The imports shown in this prompt are correct — don't verify them by introspecting installed packages. If something seems off, re-read this prompt, not `node_modules`.
3. **Read budget: ~12 files for discovery.** Before writing any code you may Read at most ~12 files (`index.html`, entry, App, providers, routing, root CSS, 2–3 representative pages/components, 1–2 hooks, 1 test). If you need more, summarize and move on.
4. **Edit > Write.** For any file you've Read, use `Edit`. Use `Write` only for new files. The project already has a `.storybook/preview.tsx` from `storybook init` — **Edit** it, do not overwrite.
5. **Batch the test loop.** Write **all** stories first, then run vitest **once** across everything. No per-file vitest runs until after that first batch run reveals failures.
6. **Use `yarn` for every install** (detected from this project's lockfile).
7. **Prefer fixing the shared `.storybook/preview.tsx`** over story-local workarounds when multiple stories fail the same way.
8. **Stop when the success criteria are met** — don't keep polishing.

## Plan (do not skip steps, but keep each step lean)

### Step 1 — Discover the runtime (≤12 reads)

Identify, in this order, using Glob/Grep first then targeted Reads:

- `index.html` — `<link rel="stylesheet">` tags, inline `<style>` blocks, fonts, and any `<div id="...">` mount or portal roots that aren't created by JS
- entry file (`main.tsx` / `index.tsx`) — providers wrapping `<App />`, root CSS imports
- `App.tsx` — top-level layout, router usage, providers it consumes
- providers / context files — what they expose
- root CSS — global styles, CSS variables, theme tokens (both JS-imported CSS **and** anything linked from `index.html`)
- data hooks — `fetch(...)`, `useQuery`, `axios`, etc. (capture base URL + endpoints actually called during render)
- browser state actually read at render — `localStorage`/`sessionStorage`/cookie keys
- portal targets — `createPortal(...)` and the DOM ids it mounts to (e.g. `#modal-root`)
- 1–2 real page or feature components (your story source-of-truth for JSX patterns)

Stop reading once you can answer: *"What providers, CSS, browser state, and network calls must the preview supply for a typical page to render?"*

### Step 2 — Build the shared preview

Set up Storybook **once** so most stories work without per-story setup. **Edit the existing `.storybook/preview.tsx`** (created by `storybook init`) — add to its existing config object, don't replace it.

The complete shape should look like this (merge the new pieces into what's already there):

```tsx
// .storybook/preview.tsx
import type { Preview } from '@storybook/react-vite';
import '../src/index.css';
import MockDate from 'mockdate';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { SessionProvider } from '../src/contexts/SessionContext';
import { mswHandlers } from './msw-handlers';

initialize({ onUnhandledRequest: 'bypass' });

const preview: Preview = {
  decorators: [
    (Story) => (
      <SessionProvider>
        <Story />
      </SessionProvider>
    ),
  ],
  loaders: [mswLoader],
  parameters: { msw: { handlers: mswHandlers } },
  async beforeEach() {
    localStorage.setItem('theme', 'dark');
    MockDate.set('2024-04-01T12:00:00Z');
  },
};

export default preview;
```

Rules for the preview:

- Use the **real** provider tree and the **real** root CSS import. Don't invent providers.
- If the app's CSS is loaded via `<link>` in `index.html` (rather than imported in JS), import the same file from preview so stories render with the same styles.
- Seed only the specific browser-state keys the app actually reads. Do **not** clear all of `localStorage`/`sessionStorage`/cookies, and do not reset Storybook's own state.
- Use `mockdate` only when render output depends on the date.
- Do not mock `window`, `document`, `navigator`, observers, or `fetch` directly.

### Step 3 — Portals (in a decorator, not preview-body.html)

If you found `createPortal(..., document.getElementById('foo'))` in Step 1, **add a decorator in `.storybook/preview.tsx` that creates the portal root** before the story renders. Do not use `preview-body.html`.

```tsx
// Add this entry to the `decorators` array of your preview config:
(Story) => {
  for (const id of ['modal-root', 'drawer-root', 'toast-root']) {
    if (!document.getElementById(id)) {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
    }
  }
  return <Story />;
}
```

Add this decorator to the `decorators` array of your preview config. Skip this step entirely if portals only target `document.body`.

### Step 4 — MSW handlers (only what stories will hit)

Use `msw-storybook-addon`. Install with:

```bash
yarn add --dev msw msw-storybook-addon mockdate
npx msw init ./public --save
```

Make sure `.storybook/main.ts` serves `./public`:

```ts
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = { staticDirs: ['../public'] };
export default config;
```

Put handlers in `.storybook/msw-handlers.ts`. Cover only the endpoints your stories will exercise — no catch-alls.

```ts
// .storybook/msw-handlers.ts
import { http, HttpResponse } from 'msw';

export const mswHandlers = {
  products: [
    http.get('https://api.example.com/products', () =>
      HttpResponse.json({ items: [{ id: 'p1', name: 'Example', price: 42 }] })
    ),
  ],
};
```

### Step 5 — Write up to 10 story files (in one batch)

The deliverable for this step is **two things, both required**:

1. Up to 10 colocated `*.stories.tsx` files for meaningful targets in the codebase.
2. **Exactly one `CssCheck` story** added to one of those files (spec below). This is part of Step 5; the step is not done without it.

**Step 5a — pick targets and write the files.** Pick ~10 meaningful targets from the real codebase (low-level reusable → page components). Skip subcomponents, hooks, contexts, helpers, and `App` itself when real page components exist.

Each story file: ~3 exports for typical components, up to ~10 when warranted by real usage. Copy JSX patterns from real pages/routes/tests.

**Tag every new story file with `['ai-generated', 'needs-work']` from the start.** You will remove `'needs-work'` only after vitest confirms the file passes. This way, anything not yet verified — including stories you ran out of time to fix — stays correctly marked.

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Button } from './Button';

const meta = {
  component: Button,
  tags: ['ai-generated', 'needs-work'], // strip 'needs-work' once vitest passes
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Smoke check — one is enough per file
export const Primary: Story = {
  args: { children: 'Order now' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /order now/i })).toBeVisible();
  },
};

// Variant-only stories: no play needed
export const Clear: Story = { args: { children: 'Cancel', clear: true } };
export const Large: Story = { args: { children: 'Checkout', large: true } };
export const WithIcon: Story = { args: { icon: 'cart', 'aria-label': 'food cart' } };
```

Story rules:

- Start every meta with `tags: ['ai-generated', 'needs-work']`.
- Show all imports explicitly.
- Don't add a custom `title`.
- Don't build large story-specific harnesses — fix preview instead.
- Don't create new app components.

**Step 5b — add the single `CssCheck` story.** Before you finish Step 5, pick **one** visually distinctive component from the files you just wrote and add a `CssCheck` export to that file. Exactly **one** `CssCheck` across the whole project — not one per file. Step 5 is not complete until this exists.

Why it's mandatory: `toBeVisible` passes on an unstyled component. A concrete `getComputedStyle` value is the only proof that the shared preview actually loaded the app's CSS — without it, you have no idea whether your stories are rendering correctly.

How: read a real styling value from the component's source (e.g. a hex color in styled-components, a Tailwind class like `bg-blue-600`, a CSS variable from the theme), and assert the resolved `getComputedStyle` value:

```tsx
export const CssCheck: Story = {
  args: { children: 'Submit' },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: /submit/i });
    // PrimaryButton uses bg-blue-600 — fails if Tailwind / global CSS did not load.
    await expect(getComputedStyle(button).backgroundColor).toBe('rgb(37, 99, 235)');
  },
};
```

### Step 6 — Add `play` functions only where they prove something non-trivial

**Do not put a `play` on every story.** A `play` is worth writing only when it asserts something the rendered output alone doesn't already prove. Prefer one good `play` per file over five redundant ones.

Write a `play` when it can verify:

- an **interaction** (form fill + submit, click → menu opens, tab change reveals panel)
- **async data** actually arrived from MSW (waiting for mocked content to replace a spinner)
- a **portal** rendered into the right root (query via `canvasElement.ownerDocument`)
- a **CSS-driven state** that matters semantically (e.g. theme color, disabled styling, layout that confirms the global stylesheet loaded)
- **accessibility** that the component is responsible for (correct role/label exposure)

**Skip `play` entirely** when a story is just a static variant of the same component (different `args`, no new behavior). Repeating `getByRole(...).toBeVisible()` across `Clear`, `Large`, `WithIcon` etc. is redundant — the render itself already fails the test if the component throws or doesn't mount.

**Smoke plays must prove something the render alone doesn't.** A play that does only `await expect(canvas.getByRole('button')).toBeVisible()` adds nothing — the render already failed if the button didn't mount. Acceptable smoke plays assert one of:

- an **aria attribute reflecting state** (`aria-expanded`, `aria-disabled`, `aria-checked`, `aria-current`)
- a **prop value rendered as text or attribute** (e.g. `args.label` appears in the DOM, `href` matches `args.to`)
- **async content arriving** (`findBy*`, `waitFor` — proves the loader/MSW handler actually resolved)
- a **portal mounting in the right root** (queried via `canvasElement.ownerDocument.body`)

If none of those apply, skip the `play` and rely on the render itself.

Concretely, in a `Button.stories.tsx` with `Primary`, `Clear`, `Large`, `WithIcon`:

- `Primary` — keep one smoke `play` (one is enough for the file).
- `Clear`, `Large`, `WithIcon` — **no `play`**. They're variant-only stories.

(The single `CssCheck` story for the whole project was added in Step 5 — don't add another one here.)

Imports & play context — get this right or vitest will fail in subtle ways:

- `expect` and `waitFor` come from `'storybook/test'` — import those.
- `canvas`, `userEvent`, and `canvasElement` come from the **play arguments**: `async ({ canvas, userEvent, canvasElement }) => { ... }`. **Do not** `import { userEvent } from 'storybook/test'` and **do not** write `const canvas = within(canvasElement)` — both are already provided.
- For **portal queries only**, query via `canvasElement.ownerDocument.body`. You may import `within` from `'storybook/test'` for that case (e.g. `within(canvasElement.ownerDocument.body).findByTestId(...)`). Don't use `within` for anything else.

```tsx
export const FilledForm: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('email'), 'a@b.com', { delay: 50 });
    await userEvent.click(canvas.getByRole('button', { name: /submit/i }));
    await expect(await canvas.findByText(/welcome/i)).toBeVisible();
  },
};
```

### Step 7 — Verify in one batch, then iterate only on failures

**Read this rule once before running anything:** the first vitest invocation must run **all** the new stories together. No single-file runs before the batch.

```bash
npx vitest --project storybook run
```

Then run the project's TypeScript check (use the script from `package.json` — typically `tsc --noEmit` or `yarn run typecheck`). Read the raw output once; don't pipe it through repeated `grep`/`head` invocations to slice it.

For each failure:

1. Read the error.
2. If multiple stories share the failure, fix the shared preview setup, not the stories.
3. Re-run vitest **only for the affected file(s)**: `npx vitest --project storybook run path/to/Foo.stories.tsx`.
4. Repeat until the file passes, then move on. Cap retries at ~2 per file — if it still fails, leave `'needs-work'` and move on.

**After a file passes**, edit its meta and remove `'needs-work'` so its tags become `['ai-generated']`. Files you couldn't fix keep `['ai-generated', 'needs-work']` — move on, don't loop forever.

### Step 8 — Clean up

Before finishing, remove debug code, broad mocks added during diagnosis, unused deps, and eval artifacts.

## Done when

- **Exactly one `CssCheck` story exists** somewhere in the new stories, asserting a concrete computed style value read from the component's source (added at the end of Step 5).
- Every story file you wrote that vitest confirmed passing has had `'needs-work'` stripped, leaving `tags: ['ai-generated']`. Anything still failing keeps `['ai-generated', 'needs-work']`.
- `npx vitest --project storybook run` passes for the new files.
- The project's TypeScript check passes for changed files.
- The shared preview is strong enough that stories don't need per-story fetch/provider workarounds.

## Reference (only fetch if stuck)

- Docs index: https://storybook.js.org/llms.txt
- Writing stories: https://storybook.js.org/docs/10/writing-stories.md?renderer=react&language=ts
- Decorators: https://storybook.js.org/docs/10/writing-stories/decorators.md?renderer=react&language=ts
- Play functions: https://storybook.js.org/docs/10/writing-stories/play-function.md?renderer=react&language=ts
- Vitest integration: https://storybook.js.org/docs/10/writing-tests/vitest-plugin.md?renderer=react&language=ts

Append `?codeOnly=true` to any docs URL for code-only snippets. Don't fetch unless a specific question can't be answered from this prompt.