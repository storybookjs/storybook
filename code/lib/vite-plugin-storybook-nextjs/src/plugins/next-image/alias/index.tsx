import { createRequire } from "node:module";
import { VITEST_PLUGIN_NAME } from "../../../utils";

const require = createRequire(import.meta.url);

type Env = "browser" | "node";

const getEntryPoint = (subPath: string, env: Env) =>
  require.resolve(`${VITEST_PLUGIN_NAME}/${env}/mocks/${subPath}`);

export const getAlias = (env: Env) => ({
  "sb-original/default-loader": getEntryPoint("image-default-loader", env),
  "sb-original/image-context": getEntryPoint("image-context", env),
});
