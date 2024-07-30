import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  // Next.js tests (non-storybook ones), run in isolation via `pnpm run test`
  "./vitest.config.mts",
  // Storybook portable stories test, run in isolation via `pnpm run test:storybook`
  "./.storybook",
]);
