import { BuildFailure, BuildResult, BuildOptions, Plugin } from 'esbuild';
export { loadTsConfig } from 'load-tsconfig';

/**
 * Dynamically import files.
 *
 * As a temporary workaround for Jest's lack of stable ESM support, we fallback to require
 * if we're in a Jest environment.
 * See https://github.com/vitejs/vite/pull/5197#issuecomment-938054077
 *
 * @param file File path to import.
 */
declare const dynamicImport: RequireFunction;

declare const JS_EXT_RE: RegExp;

type RequireFunction = (outfile: string, ctx: {
    format: "cjs" | "esm";
}) => any;
type GetOutputFile = (filepath: string, format: "esm" | "cjs") => string;
type RebuildCallback = (error: Pick<BuildFailure, "errors" | "warnings"> | null, result: BuildResult | null) => void;
interface Options {
    cwd?: string;
    /**
     * The filepath to bundle and require
     */
    filepath: string;
    /**
     * The `require` function that is used to load the output file
     * Default to the global `require` function
     * This function can be asynchronous, i.e. returns a Promise
     */
    require?: RequireFunction;
    /**
     * esbuild options
     *
     * @deprecated `esbuildOptions.watch` is deprecated, use `onRebuild` instead
     */
    esbuildOptions?: BuildOptions & {
        watch?: boolean | {
            onRebuild?: RebuildCallback;
        };
    };
    /**
     * Get the path to the output file
     * By default we simply replace the extension with `.bundled_{randomId}.js`
     */
    getOutputFile?: GetOutputFile;
    /**
     * Enable watching and call the callback after each rebuild
     */
    onRebuild?: (ctx: {
        err?: Pick<BuildFailure, "errors" | "warnings">;
        mod?: any;
        dependencies?: string[];
    }) => void;
    /** External packages */
    external?: (string | RegExp)[];
    /** Not external packages */
    notExternal?: (string | RegExp)[];
    /**
     * Automatically mark node_modules as external
     * @default true - `false` when `filepath` is in node_modules
     */
    externalNodeModules?: boolean;
    /** A custom tsconfig path to read `paths` option */
    tsconfig?: string;
    /**
     * Preserve compiled temporary file for debugging
     * Default to `process.env.BUNDLE_REQUIRE_PRESERVE`
     */
    preserveTemporaryFile?: boolean;
    /**
     * Provide bundle format explicitly
     * to skip the default format inference
     */
    format?: "cjs" | "esm";
}

declare const tsconfigPathsToRegExp: (paths: Record<string, any>) => RegExp[];
declare const match: (id: string, patterns?: (string | RegExp)[]) => boolean;
/**
 * An esbuild plugin to mark node_modules as external
 */
declare const externalPlugin: ({ external, notExternal, externalNodeModules, }?: {
    external?: (string | RegExp)[] | undefined;
    notExternal?: (string | RegExp)[] | undefined;
    externalNodeModules?: boolean | undefined;
}) => Plugin;
declare const injectFileScopePlugin: () => Plugin;
declare function bundleRequire<T = any>(options: Options): Promise<{
    mod: T;
    dependencies: string[];
}>;

export { GetOutputFile, JS_EXT_RE, Options, RebuildCallback, RequireFunction, bundleRequire, dynamicImport, externalPlugin, injectFileScopePlugin, match, tsconfigPathsToRegExp };
