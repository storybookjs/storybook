import { createRequire } from "node:module";
import { resolve, sep } from "node:path/posix";

import type { UserConfig } from "vite";

const require = createRequire(import.meta.url);

export const VITEST_PLUGIN_NAME = "vite-plugin-storybook-nextjs";

export const isVitestEnv = process.env.VITEST === "true";

export function getExecutionEnvironment(config: UserConfig) {
  return isVitestEnv && config.test?.browser?.enabled !== true
    ? "node"
    : "browser";
}

export const getNextjsVersion = (): string =>
  require(scopedResolve("next/package.json")).version;
/**
 * This is copied from Storybook's monorepo
 * https://github.com/storybookjs/storybook/blob/0e1c9a50941bd318c2154c1568fded057c38e07b/code/frameworks/nextjs/src/utils.ts#L85
 */

export const scopedResolve = (id: string): string => {
  // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
  let scopedModulePath;

  try {
    scopedModulePath = require.resolve(id, { paths: [resolve()] });
  } catch (e) {
    scopedModulePath = require.resolve(id);
  }

  const idWithNativePathSep = id.replace(/\//g /* all '/' occurrences */, sep);

  // If the id referenced the file specifically, return the full module path & filename
  if (scopedModulePath.endsWith(idWithNativePathSep)) {
    return scopedModulePath;
  }

  // Otherwise, return just the path to the module folder or named export
  const moduleFolderStrPosition =
    scopedModulePath.lastIndexOf(idWithNativePathSep);
  const beginningOfMainScriptPath = moduleFolderStrPosition + id.length;
  return scopedModulePath.substring(0, beginningOfMainScriptPath);
};

export const getNextjsMajorVersion = (): number => {
  try {
    const version = getNextjsVersion();
    return Number.parseInt(version.split(".")[0], 10);
  } catch (error) {
    return 16;
  }
};
