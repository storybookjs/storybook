---
name: storybook-init
description: Use when adding Storybook to a project that does not have Storybook configured yet.
---

If Storybook is already installed (`package.json`, `.storybook/`), do not install it again: switch to `/storybook-setup`.

1. Check the latest stable release with `npm view storybook version`. If it is 11.0 or later, run `npm create storybook@latest` inside your project's root directory; if it is below 11.0, run `npm create storybook@next` instead to get the 11.0 prerelease. Use the matching package-manager command when appropriate, such as `pnpm create storybook@next` or `yarn create storybook@next`.
2. Invoke the `/storybook-setup` skill to help the user set up project-specific Storybook configuration, such as the `.storybook/preview.ts` file.
