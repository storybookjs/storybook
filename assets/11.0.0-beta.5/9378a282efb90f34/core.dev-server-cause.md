# core.dev-server: cause

File: `.storybook/github-link.ts` line 6 (`import { IconButton } from "storybook/internal/components";`) and line 31 (`h(IconButton, { active }, ...)`).

Why it fails: Storybook 11.0.0-beta.5 removes `IconButton` from `storybook/internal/components`. The Vite build of the
manager UI then fails with `No matching export ... for import "IconButton"` and `storybook dev` exits.
Error text: dev-after.log (SB_CORE-SERVER_0004 NoMatchingExportError).

Documented: MIGRATION.md "Deprecated addon UI APIs removed" (line 675), table row `IconButton` -> `Button` with
`variant="ghost"`, `padding="small"`, and `ariaLabel`. The error text says the versions don't match or an addon
is built for an older Storybook, and points at `npx storybook doctor`, which does not mention the removed API.
The error does not point at the guide.

Fix tried: replace with `Button` (variant ghost, padding small, ariaLabel). `Button.active` is also removed, and this link is
not a toggle, so the `active` prop is dropped.

Also seen (not a failure): dev-after.log shows "Multiple story files share the component id 'column-views-correlation-chart'".
The baseline log has no such warning.
