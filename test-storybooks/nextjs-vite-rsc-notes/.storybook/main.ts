import { fileURLToPath } from "node:url";

import { defineMain } from "@storybook/nextjs-vite-rsc/node";

import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";

import * as schema from "../db/schema.ts";

// Google Fonts, without the network.
process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES = fileURLToPath(
  new URL("./google-fonts.cjs", import.meta.url),
);

export default defineMain({
  stories: ["../app/**/*.stories.tsx", "../components/**/*.stories.tsx"],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/nextjs-vite-rsc",
    options: {
      // MSW, which preview.ts starts, reads the storage of the page: it is not server code.
      browserModules: ["**/node_modules/msw/**", "**/node_modules/@mswjs/**"],
    },
  },
  // MSW's worker, for the service that the cache probe fetches from.
  staticDirs: ["../public"],
  core: { disableTelemetry: true },
  // The SQL of the schema, for the database that preview.ts makes in the browser.
  async viteFinal(config) {
    const statements = await generateMigration(
      generateDrizzleJson({}),
      generateDrizzleJson(schema),
    );
    return {
      ...config,
      define: { ...config.define, __SCHEMA_SQL__: JSON.stringify(statements.join("\n")) },
    };
  },
});
