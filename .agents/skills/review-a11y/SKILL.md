---
name: review-a11y
description: Review a Storybook change for accessibility - semantics, landmarks, accessible names, language, keyboard access, focus management, contrast, motion, and screen reader announcements. Use for a community PR, a teammate's PR, or your own branch before opening a PR, whenever it changes rendered UI in the manager, doc blocks, controls, addon panels, the design system, or CLI-generated templates.
metadata:
  internal: true
---

# Review Accessibility

This skill reviews a change for accessibility, using the rules Storybook maintainers apply in real reviews.
Read that file when you need to calibrate a finding or check how a similar case was handled.
This skill adds to the [code review guideline](../../guidelines/code-review.md); follow its rules on evidence and feedback too.

The output is a **draft** for a human.
Never submit a review, post a comment, edit files, or apply labels unless the user explicitly asks for that specific action.

## Workflow

### 1. Get the change

| Target | Command |
| --- | --- |
| A PR | `gh pr view <n> --repo storybookjs/storybook --json title,body,files,author` and `gh pr diff <n> --repo storybookjs/storybook` |
| Your own branch | `git diff origin/next...HEAD`, plus `git diff` for uncommitted work |

Read the existing PR comments too, so the draft does not repeat what a reviewer already said.

### 2. Find the rendered surfaces

List every surface the diff changes, and the users who reach it:

| Surface | Where it lives | Notes |
| --- | --- | --- |
| Manager UI | `code/core/src/manager/` | Always English; landmarks and region shortcuts apply |
| Design system | `code/core/src/components/` | A fix here reaches every screen; a regression does too |
| Doc blocks and controls | `code/addons/docs/src/blocks/` | Rendered inside user docs pages; Storybook's own chrome there stays `lang="en"` |
| Addon panels | `code/addons/*/src/components/`, `code/core/src/*/components/` | Panels sit inside the `aside` landmark |
| Story rendering behaviour | Preview, play functions, autoplay | Motion rules apply to what plays without user action |
| CLI templates | Generated example stories and components | Users copy these, so they must model accessible markup |

If the diff renders nothing (pure Node code, build tooling, types), say "No accessibility impact" with one sentence of reasoning and stop.

### 3. Review against the checklist

Go through every section below for each surface.
A rule that does not apply gets no comment.

### 4. Verify

Report only what you ran.
If you could not run something, list it under "Not verified" with the reason.

- **Code reading**: always.
- **Internal UI**: `cd code && yarn storybook:ui`, then use the story or screen the diff touches.
- **Keyboard only**: Tab and Shift+Tab, arrow keys inside composite widgets, Escape, F6 and Shift+F6 for landmarks, and the `1`, `2`, `3` region shortcuts.
- **Firefox** for anything scrollable or focus-related, because Chrome makes scroll containers focusable by default and hides the bug.
- **Emulation**: `prefers-reduced-motion`, forced colours, and both light and dark themes in browser devtools.
- **Screen reader**: VoiceOver or NVDA for anything that changes names, roles, live regions, landmarks, or `lang`.
- **Automated**: the Accessibility panel locally and in the PR's Chromatic build, and `yarn storybook:vitest` for affected stories.
  axe does not catch focus order, focus loss, motion, or announcement quality, so a clean panel is not a pass.

## Checklist

Cite the WCAG success criterion with its level and a link to its Understanding page whenever one applies, for example [SC 2.1.1 Keyboard (A)](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html).

### Semantics and landmarks

- Landmarks (`banner`, `search`, `nav`, `main`, `region`, `aside`) are the fastest way to navigate, so use them sparingly.
  The manager's map is: sidebar header as `banner`, search as `search`, explorer as `nav`, preview as `main`, toolbar as `region`, and addon panel as `aside`.
  A new landmark inside one of those, or a small part of a widget marked as a `region`, dilutes F6 and screen reader landmark navigation.
- Do not add headings to widgets that do not need them.
  A `details` element needs a `summary`, not a heading; extra headings clutter a screen reader's headings list.
  Do add headings where a screen has real sections with no structure (for example the titles of collections on a summary screen).
- Respect landmark nesting: a `footer` does not belong inside `main`, and a message that is the main content of a screen belongs in `main`.
- Expose state and structure through roles:
  an on/off control is a `switch` (`ToggleButton`), not a button styled as active;
  a set of items whose count matters is a list;
  a labelled cluster is a `group` with `aria-labelledby`;
  tabs are a `tablist` with `tab` and `tabpanel`.
- Decorative glyphs (a required `*`, an icon next to text) are `aria-hidden`.
- An anchor without `href` is not a link and is not focusable; it must be a button.
  The design system's `Link` already renders a button when there is no `href`.

### Accessible names and descriptions

- Every control has an accessible name.
  `Button` takes `ariaLabel` for icon-only buttons and `ariaLabel={false}` when the visible text is the name; flag new buttons that pass neither.
  `Modal` and popovers need an `ariaLabel` as well.
- The accessible name contains the visible label text, in the same words, so speech-input users can say what they see ([SC 2.5.3 Label in Name (A)](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html)).
- A visually hidden label still needs a visible cue for sighted users, such as a placeholder.
- Names are plain strings built from human-readable values: the formatted story title, not the story ID.
- Tooltips: the tooltip wrapper suppresses react-aria's automatic `aria-describedby` so a screen reader does not read the label twice.
  A change must keep an explicit description when a component provides one, and must not clone the child element twice.
- A control's purpose is clear out of context: "Select story" rather than "Open story list" when the result is a selection.
- Required form inputs expose `aria-required`, on the input or the fieldset.

### Language

- The Storybook UI is in English.
  `lang` on the manager stays `en`, or screen readers read every ARIA label with the wrong pronunciation ([SC 3.1.1 Language of Page (A)](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html)).
- User content (stories, docgen descriptions, MDX) may set its own `lang`.
  Storybook's own controls rendered inside user content (doc block toolbars, "Show code", copy buttons) carry `lang="en"` ([SC 3.1.2 Language of Parts (AA)](https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts.html)).

### Keyboard

- Everything that works with a mouse works with a keyboard ([SC 2.1.1 Keyboard (A)](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)).
- Content revealed on `:hover` is also revealed on `:focus-within`, ideally through CSS rather than mouse event handlers.
- Disabled buttons stay focusable through `aria-disabled` and say why they are unavailable in their tooltip.
  Visible and disabled is better than hidden, because users can still discover the feature.
- A scrollable area with static content is focusable (`ScrollArea` with `focusable`), so keyboard users can scroll it.
- Composite widgets (tabs, menus, trees, toolbars) have one Tab stop and use arrow keys inside.
- Toolbar tools that open a popup also respond to ArrowDown, as the other toolbar tools do.
- Keyboard shortcuts:
  a shortcut whose feature is unavailable must not swallow the key;
  F6 and Shift+F6 always reach react-aria;
  Escape belongs to the topmost overlay first, so an overlay that handles Escape stops its propagation.

### Focus management

- Never move focus the user did not ask to move.
  Code that blurs, refocuses, or restores focus first checks where focus was, for example "only refocus the preview if it owned focus before the drag".
  Otherwise focus jumps from the manager into the preview, or the focus indicator is lost.
- Focus moved by code that the user should see uses `focusVisible`.
  Region shortcuts (`1`, `2`, `3`, Alt+A, Alt+S) show the region indicator on `:focus`, not only `:focus-visible`, because a shortcut does not count as keyboard focus.
- Overlays that cover other UI trap focus with react-aria `FocusScope` (`contain`, `autoFocus`, `restoreFocus`): opening moves focus inside, Tab cycles inside, and closing returns focus to the trigger.
- Import `FocusScope` from `react-aria/FocusScope`, which the manager shares as a global.
  Two copies of the focus module cannot nest their scopes, which makes Tab skip every other element.
- Focus indicators stay visible ([SC 2.4.7 Focus Visible (AA)](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)):
  `all: unset` removes the outline,
  an ancestor with `overflow: hidden` crops the ring,
  and a new scroll container can clip it.
- Two async focus operations must not race: a fast second shortcut wins over a slow first one.
- After content is removed (closing a panel, deleting an item), focus goes somewhere sensible rather than to `body`.

### Contrast and colour

- Text needs 4.5:1, or 3:1 for large text ([SC 1.4.3 Contrast (Minimum) (AA)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).
- Borders, icons, and focus rings that identify a control or its state need 3:1 against adjacent colours ([SC 1.4.11 Non-text Contrast (AA)](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).
- Quantify every finding: the measured ratio, the required ratio, and the value that meets it.
  "1.36 today, 1.91 with this PR, needs 3.0; 34% opacity reaches it" is a finding, "contrast looks low" is not.
- Check default, hover, selected, and error states, in light theme, dark theme, and forced colours.
- Use theme tokens instead of hardcoded colours for one screen.
- State is not shown by colour alone, for example a selected tab marked only by border colour ([SC 1.4.1 Use of Color (A)](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)).
- If meeting the ratio means changing the visual design, recommend asking the design team instead of approving a partial improvement.

### Motion

- Animation triggered by interaction respects `prefers-reduced-motion` ([SC 2.3.3 Animation from Interactions (AAA)](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)).
  Storybook treats this criterion as required.
- Animation that starts on its own stops within 5 seconds, or has a control that stops it ([SC 2.2.2 Pause, Stop, Hide (A)](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)).
  An animation that starts while its element is still hidden spends that time unseen.
- For reduced motion, prefer a gentle pulse in opacity to rotation, sliding, or zooming, which can trigger vestibular symptoms.
- Stories that play on their own (play functions, autoplay) fall under the same rules.

### Announcements

- Status changes that sighted users see are announced: test runs starting and finishing, copy confirmations, loading, and errors ([SC 4.1.3 Status Messages (AA)](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)).
- Use `announce()` from `@react-aria/live-announcer`, as `useCopyButton` and the testing widget do, rather than a new `aria-live` element.
- Use `polite` by default and `assertive` only for errors and failures.
- Announcements are complete sentences with counts ("Test run finished. 2 components errored, 10 passed.").

### Design system

- Hand-rolled `styled.button` and `styled.a` elements in the manager are replaced with design-system components (`Button`, `ActionList`, `TabList`, `ToggleButton`, `ScrollArea`, `Link`), which already handle focus rings, roles, and keyboard behaviour.
- Fix accessibility bugs in the shared component, not in one screen, because the same bug exists everywhere that component is used.
- A new UI pattern needs a design before it gets code.

### Tests

Follow the [testing guideline](../../guidelines/testing.md).
Ask for tests that pin the accessibility contract, not the markup:

- Stories with `play` functions that query by role and name and assert state, for example `getByRole('switch', { checked: true })`, `getByRole('heading', { level: 2 })`, or a button with `aria-disabled="true"` at the last item.
- A story for each state that has its own contrast or focus appearance, so Chromatic and the Accessibility panel cover it.
- A keyboard flow in a `play` function (`userEvent.tab()`, `userEvent.keyboard('{ArrowDown}')`) when the change is about focus order or keyboard access.
- Manual testing steps that say which browser, which emulation, and which screen reader, when automation cannot check the behaviour.

## Writing findings

Each finding has:

1. **Title**: one short line.
2. **Where**: the smallest useful changed line range, as `path:line` or `path:start-end`.
3. **What fails**: the trigger and its consequence, and the WCAG criterion when one applies.
4. **Who it affects**: keyboard users, screen reader users, speech-input users, low-vision users, or people with vestibular disorders.
5. **Evidence**: what you observed, with a command or steps a maintainer can rerun, such as a story URL and the keys to press.
6. **Fix**: the concrete change, as a `suggestion` block when it is small.

Rank findings:

| Severity | Meaning |
| --- | --- |
| Blocker | A Level A or AA failure the change introduces, or a regression in focus, keyboard access, or names |
| Should fix | An AA or AAA gap the change touches but did not cause, or a fix that only partly meets the criterion |
| Nit | Polish that improves the experience without a criterion failing |

Keep the tone direct and specific.
Prefix questions with `q:` and optional polish with `nit:`.
Thank the author for accessibility work the change gets right; say what it got right in one line.

## Output format

Return, in this order:

1. **Verdict**: no accessibility impact, approve, or changes needed, with one sentence of reasoning.
2. **Surfaces**: the rendered surfaces the diff touches.
3. **Findings**: grouped by severity, in the format above.
4. **Verified**: what you ran and what you saw.
5. **Not verified**: what still needs a keyboard, screen reader, or browser check, written as steps someone can follow.
6. **People to involve**: the design team for contrast or visual trade-offs, the docs owner for documentation of keyboard features.
