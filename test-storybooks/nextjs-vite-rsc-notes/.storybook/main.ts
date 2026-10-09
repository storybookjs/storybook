import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { defineMain } from "@storybook/nextjs-vite-rsc/node";

import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";

import * as schema from "../db/schema.ts";
import { dumpDatabase, dumpPath } from "./database.ts";

// Google Fonts, without the network.
process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES = fileURLToPath(
  new URL("./google-fonts.cjs", import.meta.url),
);

// The database that preview.ts starts from, made once per `storybook dev` or
// `storybook build`: see database.ts.
const dumpFile = fileURLToPath(new URL("../node_modules/.cache/notes-db.tgz", import.meta.url));
let dumped: Promise<void> | undefined;

async function writeDump() {
  const statements = await generateMigration(
    generateDrizzleJson({}),
    generateDrizzleJson(schema),
  );
  const dump = await dumpDatabase(statements.join("\n"));
  await mkdir(dirname(dumpFile), { recursive: true });
  // Whole or not at all, for a `storybook dev` that serves the file meanwhile.
  const partFile = `${dumpFile}.${process.pid}.part`;
  await writeFile(partFile, new Uint8Array(await dump.arrayBuffer()));
  await rename(partFile, dumpFile);
}

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
  // MSW's worker, for the service that the cache probe fetches from, and the
  // dump of the database. After the static dirs of Storybook itself.
  async staticDirs(dirs = []) {
    await (dumped ??= writeDump());
    return [...dirs, "../public", { from: dumpFile, to: dumpPath }];
  },
  core: { disableTelemetry: true },
});
