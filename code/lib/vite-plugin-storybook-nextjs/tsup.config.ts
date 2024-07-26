import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/plugins/next-image/alias/next-image.tsx",
    "src/plugins/next-image/alias/next-legacy-image.tsx",
    "src/plugins/next-image/alias/image-default-loader.tsx",
    "src/plugins/next-image/alias/image-context.tsx",
  ],
  splitting: false,
  clean: true,
  format: ["esm"],
  treeshake: true,
  dts: true,
  target: "node18",
  external: [
    "sb-original/image-context",
    "sb-original/default-loader",
    "react",
    "sharp",
    "next",
  ],
});
