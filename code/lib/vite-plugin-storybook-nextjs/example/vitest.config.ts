import Inspect from "vite-plugin-inspect";
import vitePluginNext from "vite-plugin-storybook-nextjs";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    // @ts-expect-error TODO fix this later
    vitePluginNext(),
    Inspect({ build: true, outputDir: ".vite-inspect" }),
  ],
  test: {
    name: "next",
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    env: {
      // Necessary to avoid "act(...) is not supported in production builds of React"
      // for some reason Testing-library is resolving the production build of React in the tests
      NODE_ENV: "test",
    },
  },
});
