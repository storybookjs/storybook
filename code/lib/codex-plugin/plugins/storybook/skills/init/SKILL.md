---
name: init
description: Use when adding Storybook to a project that does not have Storybook configured yet.
---

1. Run `npm create storybook@latest` inside your project's root directory to install the latest version of Storybook (if the latest stable release is below 11.0, run `npm create storybook@next` instead to get the 11.0 alpha). Use the matching package-manager command when appropriate, such as `pnpm create storybook@latest` or `yarn create storybook`.
2. Invoke the `$storybook:setup` skill to help the user set up project-specific Storybook configuration, such as the `.storybook/preview.ts` file.
