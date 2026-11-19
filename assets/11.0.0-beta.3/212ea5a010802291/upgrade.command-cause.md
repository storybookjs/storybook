# upgrade.command: install fails after the automigration bump

- Failing command: `npx storybook@11.0.0-beta.3 upgrade --yes` (log: upgrade-npx.log).
- The automigration `upgrade-storybook-related-dependencies` changed
  `packages/frontend/@n8n/storybook/package.json` and
  `packages/frontend/@n8n/design-system/package.json`:
  `storybook-addon-vue-mdx` from `3.0.0` to `^4.0.0`.
- `storybook-addon-vue-mdx@4.0.0` declares peer `@storybook/builder-vite: ^11.0.0`
  (`pnpm view storybook-addon-vue-mdx@^4.0.0 peerDependencies`).
- No `@storybook/builder-vite@11.0.0` is published. The only 11.x release is the
  `next` tag `11.0.0-beta.3` (`pnpm view @storybook/builder-vite dist-tags`).
- pnpm auto-installs peers, so it fails with `ERR_PNPM_NO_MATCHING_VERSION`:
  `No matching version found for @storybook/builder-vite@^11.0.0`.
- Also: the workspace `allowBuilds` policy (pnpm-workspace.yaml) blocked the
  `pnpm dlx` path with `ERR_PNPM_IGNORED_BUILDS` (environment, see upgrade.log).
