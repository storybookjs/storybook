// In Storybook's dev server `#lib/db.ts` is lib/db.dev.ts: package.json
// imports it so under the `development` condition, which Vitest's config
// leaves out. The mock is the same module as the one of lib/db.ts.
export * from "./db.ts";
