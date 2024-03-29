import { defineConfig } from "cypress";

export default defineConfig({
  screenshotOnRunFailure: false,
  component: {
    devServer: {
      framework: "vue",
      bundler: "vite",
    },
  },
});
