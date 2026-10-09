import { createRequire } from "node:module";

// @next/env is CommonJS; createRequire works across Playwright's Node loader
// and Drizzle Kit's Bun-loaded config.
const require = createRequire(import.meta.url);
// oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- @next/env is CJS, so createRequire returns any.
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

const dev = process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";
loadEnvConfig(process.cwd(), dev);
