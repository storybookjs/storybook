// addon-vitest's run-story-tests starts Vitest from the project root, so the
// storybook test project must be reachable from the default config. The eval
// runner overwrites this file before executing EVAL.ts; it only matters while
// the agent runs.
export { default } from './vitest.storybook.config.ts';
