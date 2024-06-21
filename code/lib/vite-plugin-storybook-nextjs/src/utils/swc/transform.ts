import type loadJsConfig from "next/dist/build/load-jsconfig";
import type { findPagesDir } from "next/dist/lib/find-pages-dir";
import type { NextConfigComplete } from "next/dist/server/config-shared";
import type { SourceMap } from "rollup";
import type { getPackageJSON } from "../packageJSON";
import { getVitestSWCOptions } from "./options";

type VitestSWCTransformConfigParams = {
	filename: string;
	inputSourceMap: SourceMap;
	isServerEnvironment: boolean;
	loadedJSConfig: Awaited<ReturnType<typeof loadJsConfig>>;
	nextDirectories: ReturnType<typeof findPagesDir>;
	nextConfig: NextConfigComplete;
};

/**
 * Get the SWC transform options for a file which is passed to Next.js' custom SWC transpiler
 */
export const getVitestSWCTransformConfig = ({
	filename,
	inputSourceMap,
	isServerEnvironment,
	loadedJSConfig,
	nextDirectories,
	nextConfig,
}: VitestSWCTransformConfigParams) => {
	const baseOptions = getVitestSWCOptions({
		isServer: isServerEnvironment,
		filename,
		jsConfig: loadedJSConfig.jsConfig,
		resolvedBaseUrl: loadedJSConfig.resolvedBaseUrl,
		serverComponents: !!nextDirectories.appDir,
		modularizeImports: nextConfig.modularizeImports,
		swcPlugins: nextConfig.experimental.swcPlugins,
		compilerOptions: nextConfig?.compilerOptions,
		esm: true,
	});
	return {
		...baseOptions,
		inputSourceMap:
			inputSourceMap && typeof inputSourceMap === "object"
				? JSON.stringify(inputSourceMap)
				: undefined,
		sourceFileName: filename,
		filename,
	};
};
