# upgrade.command: cause

- Trigger: `npx storybook@11.0.0-beta.3 upgrade --yes` (log: upgrade.log).
- The upgrade rewrote package.json and package-lock.json. Storybook 11 no longer pulls `ts-dedent` in transitively. In Storybook 10 it came in through `@storybook/addon-docs` and `@storybook/builder-vite` (dev range ^2.0.0), per `git show HEAD:package-lock.json`.
- The repo imports `ts-dedent` without declaring it: `scripts/automate.ts:2`, `scripts/import.ts:9`, `scripts/verify.ts:2`, `src/util/storybook/LoremIpsum.tsx:5`.
- The upgrade's own `npm install` runs the `prepare` script (`npm run build`), which fails with TS2307 on `ts-dedent`. The upgrade then exits 1 with SB_CLI_INIT_0010.
- Fix tried (workaround, node_modules only): `npm install --no-save --ignore-scripts ts-dedent` (unblock-ts-dedent.log). After it, `npx tsc -b` exits 0 (tsc-post-upgrade.log).
- The repo was not edited to fix this. package.json and the lock are as the upgrade left them, in commit ecf8e44.
