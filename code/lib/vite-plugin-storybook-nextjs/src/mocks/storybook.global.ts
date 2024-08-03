import { createRequire } from "node:module";
// @ts-ignore no types
import moduleAlias from "module-alias";
import { getAlias as getNextImageAlias } from "../plugins/next-image/alias";
import { getAlias as getNextMocksAlias } from "../plugins/next-mocks/plugin";

const require = createRequire(import.meta.url);

moduleAlias.addAliases({
  react: "next/dist/compiled/react",
  "react-dom/test-utils": require.resolve(
    "next/dist/compiled/react-dom/cjs/react-dom-test-utils.production.js",
  ),
  "react-dom": "next/dist/compiled/react-dom",
  ...getNextMocksAlias("node"),
  ...getNextImageAlias("node"),
});
