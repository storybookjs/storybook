---
name: storybook-init
description: Use when adding Storybook to a project that does not have Storybook configured yet.
---

1. Run `npm create storybook@latest` inside your project's root directory to install the latest version of Storybook (if the latest stable release is below 11.0, run `npm create storybook@next` instead). Use the matching package-manager command when appropriate, such as `pnpm create storybook@latest` or `yarn create storybook`.
2. After initialization succeeds, run `npx storybook add @storybook/addon-mcp`.
3. Invoke the `/storybook-setup` skill to help the user set up project-specific Storybook configuration, such as the `.storybook/preview.ts` file.
