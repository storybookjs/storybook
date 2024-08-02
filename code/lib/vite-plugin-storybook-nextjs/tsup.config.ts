import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: [
      "src/index.ts",
      "src/plugins/next-image/alias/next-image.tsx",
      "src/plugins/next-image/alias/next-legacy-image.tsx",
      "src/plugins/next-image/alias/image-default-loader.tsx",
      "src/plugins/next-image/alias/image-context.tsx",
      "src/plugins/next-mocks/alias/headers/cookies.ts",
      "src/plugins/next-mocks/alias/headers/headers.ts",
      "src/plugins/next-mocks/alias/headers/index.ts",
      "src/plugins/next-mocks/alias/cache/index.ts",
      "src/plugins/next-mocks/alias/navigation/index.ts",
      "src/plugins/next-mocks/alias/router/index.ts",
      "src/plugins/next-mocks/alias/rsc/server-only.ts",
      "src/mocks/storybook.global.ts",
    ],
    splitting: false,
    clean: true,
    format: ["esm", "cjs"],
    treeshake: true,
    dts: true,
    target: "node18",
    external: [
      "sb-original/image-context",
      "sb-original/default-loader",
      "storybook",
      "@storybook/test-runner",
      "@storybook/nextjs/headers.mock",
      "@storybook/test",
      "react",
      "sharp",
      "next",
    ],
  },
]);
