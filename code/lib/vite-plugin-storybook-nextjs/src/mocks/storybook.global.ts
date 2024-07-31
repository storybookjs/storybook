import { createRequire } from "node:module";
// @ts-ignore no types
import moduleAlias from "module-alias";

const require = createRequire(import.meta.url);

// I only need this in non-browser mode
moduleAlias.addAliases({
  react: "next/dist/compiled/react",
  "react-dom/test-utils": require.resolve(
    "next/dist/compiled/react-dom/cjs/react-dom-test-utils.production.js",
  ),
  "react-dom": "next/dist/compiled/react-dom",
});
