import path from "node:path";
import type { Plugin } from "vite";

const dirname = path.dirname(new URL(import.meta.url).pathname);

const joinDir = (...subPath: string[]) =>
  path.join(dirname, "plugins", "next-mocks", "alias", ...subPath);

export const vitePluginNextMocks = () =>
  ({
    name: "vite-plugin-next-mocks",
    config: () => ({
      resolve: {
        alias: {
          "next/headers": joinDir("headers", "index.js"),
          "@storybook/nextjs/headers.mock": joinDir("headers", "index.js"),
          "next/navigation": joinDir("navigation", "index.js"),
          "@storybook/nextjs/navigation.mock": joinDir(
            "navigation",
            "index.js",
          ),
          "next/router": joinDir("router", "index.js"),
          "@storybook/nextjs/router.mock": joinDir("router", "index.js"),
          "next/cache": joinDir("cache", "index.js"),
          "@storybook/nextjs/cache.mock": joinDir("cache", "index.js"),
          "server-only$": joinDir("rsc", "server-only.js"),
        },
      },
    }),
  }) satisfies Plugin;
