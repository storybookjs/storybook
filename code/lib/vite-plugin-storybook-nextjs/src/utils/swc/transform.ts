import type loadJsConfig from "next/dist/build/load-jsconfig.js";
import type { findPagesDir } from "next/dist/lib/find-pages-dir.js";
import type { NextConfigComplete } from "next/dist/server/config-shared.js";
import path from "pathe";
import type { SourceMap } from "rollup";
import { shouldOutputCommonJs } from "../nextjs";
import { getBaseSWCOptions } from "./options";

type VitestSWCTransformConfigParams = {
  filename: string;
  inputSourceMap: SourceMap;
  isServerEnvironment: boolean;
  loadedJSConfig: Awaited<ReturnType<typeof loadJsConfig>>;
  nextDirectories: ReturnType<typeof findPagesDir>;
  nextConfig: NextConfigComplete;
  rootDir: string;
  isDev: boolean;
  isEsmProject: boolean;
};

/**
 * Get the SWC transform options for a file which is passed to Next.js' custom SWC transpiler
 */
export const getVitestSWCTransformConfig = async ({
  filename,
  inputSourceMap,
  isServerEnvironment,
  loadedJSConfig,
  nextDirectories,
  nextConfig,
  rootDir,
  isDev,
  isEsmProject,
}: VitestSWCTransformConfigParams) => {
  const { compilerOptions, ...restJSConfig } = loadedJSConfig.jsConfig ?? {};
  const { paths, ...restCompilerOptions } = compilerOptions ?? {};
  const baseOptions = getBaseSWCOptions({
    filename,
    development: isDev,
    hasReactRefresh: false,
    globalWindow: !isServerEnvironment,
    jsConfig: {
      ...restJSConfig,
      compilerOptions: {
        ...restCompilerOptions,
      },
    },
    resolvedBaseUrl: loadedJSConfig.resolvedBaseUrl,
    swcPlugins: nextConfig.experimental.swcPlugins,
    compiler: nextConfig?.compiler,
    esm: isEsmProject,
    swcCacheDir: path.join(
      rootDir,
      nextConfig.distDir ?? ".next",
      "cache",
      "swc",
    ),
  });
  const useCjsModules = shouldOutputCommonJs(filename);
  const isPageFile = nextDirectories.pagesDir
    ? filename.startsWith(nextDirectories.pagesDir)
    : false;

  return {
    ...baseOptions,
    fontLoaders: {
      fontLoaders: ["next/font/local", "next/font/google"],
      relativeFilePathFromRoot: path.relative(rootDir, filename),
    },
    cjsRequireOptimizer: {
      packages: {
        "next/server": {
          transforms: {
            NextRequest: "next/dist/server/web/spec-extension/request",
            NextResponse: "next/dist/server/web/spec-extension/response",
            ImageResponse: "next/dist/server/web/spec-extension/image-response",
            userAgentFromString:
              "next/dist/server/web/spec-extension/user-agent",
            userAgent: "next/dist/server/web/spec-extension/user-agent",
          },
        },
      },
    },
    ...(isServerEnvironment
      ? {
          env: {
            targets: {
              // Targets the current version of Node.js
              node: process.versions.node,
            },
          },
        }
      : {
          env: {
            targets: await getSupportedBrowsers(rootDir, isDev),
            bugfixes: true,
          },
        }),
    module: {
      type: isEsmProject && !useCjsModules ? "es6" : "commonjs",
    },
    disableNextSsg: !isPageFile,
    isPageFile,
    pagesDir: nextDirectories.pagesDir,
    appDir: nextDirectories.appDir,
    isDevelopment: isDev,
    isServerCompiler: isServerEnvironment,
    inputSourceMap:
      inputSourceMap && typeof inputSourceMap === "object"
        ? JSON.stringify(inputSourceMap)
        : undefined,
    sourceFileName: filename,
    filename,
  };
};

async function getSupportedBrowsers(
  projectRoot: string,
  isDevelopment: boolean,
) {
  try {
    return (
      // @ts-expect-error - Correct import since Next.js v16.2
      (
        await import("next/dist/build/get-supported-browsers.js")
      ).getSupportedBrowsers(projectRoot, isDevelopment)
    );
  } catch (e) {
    // TODO: Remove as soon as we don't have to support Next.js < 16.2 anymore
    return (await import("next/dist/build/utils.js")).getSupportedBrowsers(
      projectRoot,
      isDevelopment,
    );
  }
}
