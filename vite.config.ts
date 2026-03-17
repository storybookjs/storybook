import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: {
    ignorePatterns: [
      "dist",
      "node_modules",
      "code",
      "scripts",
      // TODO: assess whether we can enable linting for these directories
      "docs",
      "test-storybooks",
    ],
  },
  fmt: {
    ignorePatterns: ["dist", "node_modules", "code", "scripts", "docs", "test-storybooks"],
  },
});
