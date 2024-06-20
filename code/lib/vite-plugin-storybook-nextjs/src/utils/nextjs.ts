import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import Log from "next/dist/build/output/log";
import { loadBindings, lockfilePatchPromise } from "next/dist/build/swc";
import loadConfig from "next/dist/server/config";
import type { NextConfigComplete } from "next/dist/server/config-shared";
import { CONFIG_FILES, PHASE_TEST } from "next/dist/shared/lib/constants";

/**
 * Load the user's Next.js configuration
 */
export async function getConfig(dir: string) {
	const conf = await loadConfig(PHASE_TEST, dir);
	return conf;
}

/**
 * Get the potential paths to the Next.js configuration files
 */
export async function getConfigPaths(dir: string) {
	return CONFIG_FILES.map((file) => join(dir, file));
}

/**
 * Set up the environment variables for the Next.js project
 */
export async function setUpEnv(dir: string) {
	const dev = false;
	loadEnvConfig(dir, dev, Log);
}

/**
 * Load the SWC bindings eagerly instead of waiting for transform calls
 */
export async function loadSWCBindingsEagerly(nextConfig?: NextConfigComplete) {
	await loadBindings(nextConfig?.experimental?.useWasmBinary);

	if (lockfilePatchPromise.cur) {
		await lockfilePatchPromise.cur;
	}
}
