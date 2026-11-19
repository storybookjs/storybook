# upgrade.command: cause

1. Policy blocker (environment): npm refused `npx storybook@11.0.0-beta.3` with ESTRICTALLOWSCRIPTS (esbuild install script not in allowScripts). Passed a one-off allowance via env (see unblock.md). No repo file changed for this.
2. Peer resolution: the CLI's first install failed with ERESOLVE (stale @storybook/addon-a11y@10.3.6 in node_modules conflicting with storybook@11.0.0-beta.3 peer) and fell back to --legacy-peer-deps (eresolve report: /home/agent/.npm/_logs/2026-11-19T09_51_59_241Z-eresolve-report.txt, copy not saved).
3. Exit 1: after install, the project's `prepare` script (`npm run build`) runs `tsc -b`, which fails:
   scripts/automate.ts(2,24), scripts/import.ts(9,24), scripts/verify.ts(2,24), src/util/storybook/LoremIpsum.tsx(5,24): TS2307 Cannot find module 'ts-dedent'.
   ts-dedent was only installed transitively by @storybook/* 10.x (package-lock.json: node_modules/ts-dedent 2.2.0 via csf-plugin etc.). Storybook 11.0.0-beta.3 does not depend on it, and the project does not declare it.
4. Fix tried: `npm install --no-save --ignore-scripts --legacy-peer-deps ts-dedent@2.2.0` (no package.json or lock edit). Build-time import now resolves.
5. Second cause, found while running the Vitest probe: --legacy-peer-deps does not install peers, so @testing-library/dom (peer of @testing-library/react, imported by tests/setup-rtl.ts) was missing. Fix tried: `npm install --no-save --ignore-scripts --legacy-peer-deps @testing-library/dom@10.4.2`.
