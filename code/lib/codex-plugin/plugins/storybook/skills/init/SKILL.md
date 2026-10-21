---
name: init
description: Use when adding Storybook to a project that does not have Storybook configured yet.
---

If Storybook is already installed (a `storybook` dependency in `package.json`, or a `.storybook/` directory), do not install it again: switch to `$storybook:setup`.

1. First check the latest stable release with `npm view create-storybook version`. If it is below 11.0, run `npm create storybook@next` inside your project's root directory to get the 11.0 alpha; otherwise run `npm create storybook@latest`. Use the matching package-manager command with the same tag when appropriate, such as `pnpm create storybook@next`.
2. Invoke the `$storybook:setup` skill to help the user set up project-specific Storybook configuration, such as the `.storybook/preview.ts` file.
