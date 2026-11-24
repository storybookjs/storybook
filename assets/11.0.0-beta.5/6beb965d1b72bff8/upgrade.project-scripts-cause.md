# upgrade.project-scripts: the --no-open flag

- `packages/twenty-front/vitest.config.ts` (`storybookScript`) and `packages/twenty-ui/vitest.config.ts`, `packages/twenty-front-component-renderer/vitest.storybook.config.ts` start `storybook dev` with `--no-open`.
- Storybook 11 rejects that flag: `no-open-repro.log` (`error: unknown option '--no-open'`).
- The 11.0.0 note "storybook dev no longer opens a browser by default" documents the removal, but the error line does not point to it.
- Fix applied in twenty-front only (`qa: apply migration notes`). The twenty-ui and component-renderer configs still use 10.x and were not changed.
