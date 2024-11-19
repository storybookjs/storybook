import { createRequire } from "node:module";
import semver from "semver";

import { VITEST_PLUGIN_NAME } from "../../../utils";
import { getNextjsVersion } from "./utils";

const require = createRequire(import.meta.url);

type Env = "browser" | "node";

const getEntryPoint = (subPath: string, env: Env) =>
  require.resolve(`${VITEST_PLUGIN_NAME}/${env}/mocks/${subPath}`);

const mapping = (
  env: Env,
): Record<string, Record<string, string | boolean>> => ({
  "<15.0.0": {
    "next/dist/server/request/headers": "next/dist/client/components/headers",
    // this path only exists from Next 15 onwards
    "next/dist/server/request/draft-mode": getEntryPoint(
      "draft-mode.compat",
      env,
    ),
  },
});

export const getCompatibilityAliases = (env: Env) => {
  const version = getNextjsVersion();
  const result: Record<string, string> = {};

  const compatMap = mapping(env);

  // biome-ignore lint/complexity/noForEach: <explanation>
  Object.keys(compatMap).forEach((key) => {
    if (semver.intersects(version, key)) {
      Object.assign(result, compatMap[key]);
    }
  });

  return result;
};
