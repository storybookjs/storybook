import { BuildOptions, Metafile, Plugin as Plugin$1, Loader } from 'esbuild';
import { SourceMap as SourceMap$1, TreeshakingOptions, TreeshakingPreset, InputOption } from 'rollup';
import { RawSourceMap } from 'source-map';

declare type GeneratedColumn = number;
declare type SourcesIndex = number;
declare type SourceLine = number;
declare type SourceColumn = number;
declare type NamesIndex = number;
declare type SourceMapSegment = [GeneratedColumn] | [GeneratedColumn, SourcesIndex, SourceLine, SourceColumn] | [GeneratedColumn, SourcesIndex, SourceLine, SourceColumn, NamesIndex];

declare class TraceMap implements SourceMap {
    version: SourceMapV3['version'];
    file: SourceMapV3['file'];
    names: SourceMapV3['names'];
    sourceRoot: SourceMapV3['sourceRoot'];
    sources: SourceMapV3['sources'];
    sourcesContent: SourceMapV3['sourcesContent'];
    resolvedSources: string[];
    private _encoded;
    private _decoded;
    private _decodedMemo;
    private _bySources;
    private _bySourceMemos;
    constructor(map: SourceMapInput, mapUrl?: string | null);
}

interface SourceMapV3 {
    file?: string | null;
    names: string[];
    sourceRoot?: string;
    sources: (string | null)[];
    sourcesContent?: (string | null)[];
    version: 3;
}
interface EncodedSourceMap extends SourceMapV3 {
    mappings: string;
}
interface DecodedSourceMap extends SourceMapV3 {
    mappings: SourceMapSegment[][];
}
interface Section {
    offset: {
        line: number;
        column: number;
    };
    map: EncodedSourceMap | DecodedSourceMap | SectionedSourceMap;
}
interface SectionedSourceMap {
    file?: string | null;
    sections: Section[];
    version: 3;
}
declare type SourceMapInput = string | Ro<EncodedSourceMap> | Ro<DecodedSourceMap> | TraceMap;
declare type SectionedSourceMapInput = SourceMapInput | Ro<SectionedSourceMap>;
declare abstract class SourceMap {
    version: SourceMapV3['version'];
    file: SourceMapV3['file'];
    names: SourceMapV3['names'];
    sourceRoot: SourceMapV3['sourceRoot'];
    sources: SourceMapV3['sources'];
    sourcesContent: SourceMapV3['sourcesContent'];
    resolvedSources: SourceMapV3['sources'];
}
declare type Ro<T> = T extends Array<infer V> ? V[] | Readonly<V[]> | RoArray<V> | Readonly<RoArray<V>> : T extends object ? T | Readonly<T> | RoObject<T> | Readonly<RoObject<T>> : T;
declare type RoArray<T> = Ro<T>[];
declare type RoObject<T> = {
    [K in keyof T]: T[K] | Ro<T[K]>;
};

/// <reference lib="es2015" />



type ECMA = 5 | 2015 | 2016 | 2017 | 2018 | 2019 | 2020;

interface ParseOptions {
    bare_returns?: boolean;
    /** @deprecated legacy option. Currently, all supported EcmaScript is valid to parse. */
    ecma?: ECMA;
    html5_comments?: boolean;
    shebang?: boolean;
}

interface CompressOptions {
    arguments?: boolean;
    arrows?: boolean;
    booleans_as_integers?: boolean;
    booleans?: boolean;
    collapse_vars?: boolean;
    comparisons?: boolean;
    computed_props?: boolean;
    conditionals?: boolean;
    dead_code?: boolean;
    defaults?: boolean;
    directives?: boolean;
    drop_console?: boolean;
    drop_debugger?: boolean;
    ecma?: ECMA;
    evaluate?: boolean;
    expression?: boolean;
    global_defs?: object;
    hoist_funs?: boolean;
    hoist_props?: boolean;
    hoist_vars?: boolean;
    ie8?: boolean;
    if_return?: boolean;
    inline?: boolean | InlineFunctions;
    join_vars?: boolean;
    keep_classnames?: boolean | RegExp;
    keep_fargs?: boolean;
    keep_fnames?: boolean | RegExp;
    keep_infinity?: boolean;
    loops?: boolean;
    module?: boolean;
    negate_iife?: boolean;
    passes?: number;
    properties?: boolean;
    pure_funcs?: string[];
    pure_getters?: boolean | 'strict';
    reduce_funcs?: boolean;
    reduce_vars?: boolean;
    sequences?: boolean | number;
    side_effects?: boolean;
    switches?: boolean;
    toplevel?: boolean;
    top_retain?: null | string | string[] | RegExp;
    typeofs?: boolean;
    unsafe_arrows?: boolean;
    unsafe?: boolean;
    unsafe_comps?: boolean;
    unsafe_Function?: boolean;
    unsafe_math?: boolean;
    unsafe_symbols?: boolean;
    unsafe_methods?: boolean;
    unsafe_proto?: boolean;
    unsafe_regexp?: boolean;
    unsafe_undefined?: boolean;
    unused?: boolean;
}

declare enum InlineFunctions {
    Disabled = 0,
    SimpleFunctions = 1,
    WithArguments = 2,
    WithArgumentsAndVariables = 3
}

interface MangleOptions {
    eval?: boolean;
    keep_classnames?: boolean | RegExp;
    keep_fnames?: boolean | RegExp;
    module?: boolean;
    nth_identifier?: SimpleIdentifierMangler | WeightedIdentifierMangler;
    properties?: boolean | ManglePropertiesOptions;
    reserved?: string[];
    safari10?: boolean;
    toplevel?: boolean;
}

/**
 * An identifier mangler for which the output is invariant with respect to the source code.
 */
interface SimpleIdentifierMangler {
    /**
     * Obtains the nth most favored (usually shortest) identifier to rename a variable to.
     * The mangler will increment n and retry until the return value is not in use in scope, and is not a reserved word.
     * This function is expected to be stable; Evaluating get(n) === get(n) should always return true.
     * @param n The ordinal of the identifier.
     */
    get(n: number): string;
}

/**
 * An identifier mangler that leverages character frequency analysis to determine identifier precedence.
 */
interface WeightedIdentifierMangler extends SimpleIdentifierMangler {
    /**
     * Modifies the internal weighting of the input characters by the specified delta.
     * Will be invoked on the entire printed AST, and then deduct mangleable identifiers.
     * @param chars The characters to modify the weighting of.
     * @param delta The numeric weight to add to the characters.
     */
    consider(chars: string, delta: number): number;
    /**
     * Resets character weights.
     */
    reset(): void;
    /**
     * Sorts identifiers by character frequency, in preparation for calls to get(n).
     */
    sort(): void;
}

interface ManglePropertiesOptions {
    builtins?: boolean;
    debug?: boolean;
    keep_quoted?: boolean | 'strict';
    nth_identifier?: SimpleIdentifierMangler | WeightedIdentifierMangler;
    regex?: RegExp | string;
    reserved?: string[];
}

interface FormatOptions {
    ascii_only?: boolean;
    /** @deprecated Not implemented anymore */
    beautify?: boolean;
    braces?: boolean;
    comments?: boolean | 'all' | 'some' | RegExp | ( (node: any, comment: {
        value: string,
        type: 'comment1' | 'comment2' | 'comment3' | 'comment4',
        pos: number,
        line: number,
        col: number,
    }) => boolean );
    ecma?: ECMA;
    ie8?: boolean;
    keep_numbers?: boolean;
    indent_level?: number;
    indent_start?: number;
    inline_script?: boolean;
    keep_quoted_props?: boolean;
    max_line_len?: number | false;
    preamble?: string;
    preserve_annotations?: boolean;
    quote_keys?: boolean;
    quote_style?: OutputQuoteStyle;
    safari10?: boolean;
    semicolons?: boolean;
    shebang?: boolean;
    shorthand?: boolean;
    source_map?: SourceMapOptions;
    webkit?: boolean;
    width?: number;
    wrap_iife?: boolean;
    wrap_func_args?: boolean;
}

declare enum OutputQuoteStyle {
    PreferDouble = 0,
    AlwaysSingle = 1,
    AlwaysDouble = 2,
    AlwaysOriginal = 3
}

interface MinifyOptions {
    compress?: boolean | CompressOptions;
    ecma?: ECMA;
    enclose?: boolean | string;
    ie8?: boolean;
    keep_classnames?: boolean | RegExp;
    keep_fnames?: boolean | RegExp;
    mangle?: boolean | MangleOptions;
    module?: boolean;
    nameCache?: object;
    format?: FormatOptions;
    /** @deprecated */
    output?: FormatOptions;
    parse?: ParseOptions;
    safari10?: boolean;
    sourceMap?: boolean | SourceMapOptions;
    toplevel?: boolean;
}

interface SourceMapOptions {
    /** Source map object, 'inline' or source map file content */
    content?: SectionedSourceMapInput | string;
    includeSources?: boolean;
    filename?: string;
    root?: string;
    url?: string | 'inline';
}

/** Mark some properties as required, leaving others unchanged */
declare type MarkRequired<T, RK extends keyof T> = Exclude<T, RK> & Required<Pick<T, RK>>;

type Logger = ReturnType<typeof createLogger>;
declare const createLogger: (name?: string) => {
    setName(_name: string): void;
    success(label: string, ...args: any[]): void;
    info(label: string, ...args: any[]): void;
    error(label: string, ...args: any[]): void;
    warn(label: string, ...args: any[]): void;
    log(label: string, type: 'info' | 'success' | 'error' | 'warn', ...data: unknown[]): void;
};

type ChunkInfo = {
    type: 'chunk';
    code: string;
    map?: string | RawSourceMap | null;
    path: string;
    /**
     * Sets the file mode
     */
    mode?: number;
    entryPoint?: string;
    exports?: string[];
    imports?: Metafile['outputs'][string]['imports'];
};
type RenderChunk = (this: PluginContext, code: string, chunkInfo: ChunkInfo) => MaybePromise<{
    code: string;
    map?: object | string | SourceMap$1 | null;
} | undefined | null | void>;
type BuildStart = (this: PluginContext) => MaybePromise<void>;
type BuildEnd = (this: PluginContext, ctx: {
    writtenFiles: WrittenFile[];
}) => MaybePromise<void>;
type ModifyEsbuildOptions = (this: PluginContext, options: BuildOptions) => void;
type Plugin = {
    name: string;
    esbuildOptions?: ModifyEsbuildOptions;
    buildStart?: BuildStart;
    renderChunk?: RenderChunk;
    buildEnd?: BuildEnd;
};
type PluginContext = {
    format: Format;
    splitting?: boolean;
    options: NormalizedOptions;
    logger: Logger;
};
type WrittenFile = {
    readonly name: string;
    readonly size: number;
};

type TreeshakingStrategy = boolean | TreeshakingOptions | TreeshakingPreset;

type KILL_SIGNAL = 'SIGKILL' | 'SIGTERM';
type Format = 'cjs' | 'esm' | 'iife';
type ContextForOutPathGeneration = {
    options: NormalizedOptions;
    format: Format;
    /** "type" field in project's package.json */
    pkgType?: string;
};
type OutExtensionObject = {
    js?: string;
    dts?: string;
};
type OutExtensionFactory = (ctx: ContextForOutPathGeneration) => OutExtensionObject;
type DtsConfig = {
    entry?: InputOption;
    /** Resolve external types used in dts files from node_modules */
    resolve?: boolean | (string | RegExp)[];
    /** Emit declaration files only */
    only?: boolean;
    /** Insert at the top of each output .d.ts file  */
    banner?: string;
    /** Insert at the bottom */
    footer?: string;
    /**
     * Overrides `compilerOptions`
     * This option takes higher priority than `compilerOptions` in tsconfig.json
     */
    compilerOptions?: any;
};
type ExperimentalDtsConfig = {
    entry?: InputOption;
    /**
     * Overrides `compilerOptions`
     * This option takes higher priority than `compilerOptions` in tsconfig.json
     */
    compilerOptions?: any;
};
type BannerOrFooter = {
    js?: string;
    css?: string;
} | ((ctx: {
    format: Format;
}) => {
    js?: string;
    css?: string;
} | undefined);
type BrowserTarget = 'chrome' | 'deno' | 'edge' | 'firefox' | 'hermes' | 'ie' | 'ios' | 'node' | 'opera' | 'rhino' | 'safari';
type BrowserTargetWithVersion = `${BrowserTarget}${number}` | `${BrowserTarget}${number}.${number}` | `${BrowserTarget}${number}.${number}.${number}`;
type EsTarget = 'es3' | 'es5' | 'es6' | 'es2015' | 'es2016' | 'es2017' | 'es2018' | 'es2019' | 'es2020' | 'es2021' | 'es2022' | 'esnext';
type Target = BrowserTarget | BrowserTargetWithVersion | EsTarget;
type Entry = string[] | Record<string, string>;
/**
 * The options available in tsup.config.ts
 * Not all of them are available from CLI flags
 */
type Options = {
    /** Optional config name to show in CLI output */
    name?: string;
    /**
     * @deprecated Use `entry` instead
     */
    entryPoints?: Entry;
    entry?: Entry;
    /**
     * Output different formats to different folder instead of using different extensions
     */
    legacyOutput?: boolean;
    /**
     * Compile target
     *
     * default to `node16`
     */
    target?: Target | Target[];
    minify?: boolean | 'terser';
    terserOptions?: MinifyOptions;
    minifyWhitespace?: boolean;
    minifyIdentifiers?: boolean;
    minifySyntax?: boolean;
    keepNames?: boolean;
    watch?: boolean | string | (string | boolean)[];
    ignoreWatch?: string[] | string;
    onSuccess?: string | (() => Promise<void | undefined | (() => void | Promise<void>)>);
    jsxFactory?: string;
    jsxFragment?: string;
    outDir?: string;
    outExtension?: OutExtensionFactory;
    format?: Format[] | Format;
    globalName?: string;
    env?: {
        [k: string]: string;
    };
    define?: {
        [k: string]: string;
    };
    dts?: boolean | string | DtsConfig;
    experimentalDts?: boolean | string | ExperimentalDtsConfig;
    sourcemap?: boolean | 'inline';
    /** Always bundle modules matching given patterns */
    noExternal?: (string | RegExp)[];
    /** Don't bundle these modules */
    external?: (string | RegExp)[];
    /**
     * Replace `process.env.NODE_ENV` with `production` or `development`
     * `production` when the bundled is minified, `development` otherwise
     */
    replaceNodeEnv?: boolean;
    /**
     * Code splitting
     * Default to `true` for ESM, `false` for CJS.
     *
     * You can set it to `true` explicitly, and may want to disable code splitting sometimes: [`#255`](https://github.com/egoist/tsup/issues/255)
     */
    splitting?: boolean;
    /**
     * Clean output directory before each build
     */
    clean?: boolean | string[];
    esbuildPlugins?: Plugin$1[];
    esbuildOptions?: (options: BuildOptions, context: {
        format: Format;
    }) => void;
    /**
     * Suppress non-error logs (excluding "onSuccess" process output)
     */
    silent?: boolean;
    /**
     * Skip node_modules bundling
     * Will still bundle modules matching the `noExternal` option
     */
    skipNodeModulesBundle?: boolean;
    /**
     * @see https://esbuild.github.io/api/#pure
     */
    pure?: string | string[];
    /**
     * Disable bundling, default to true
     */
    bundle?: boolean;
    /**
     * This option allows you to automatically replace a global variable with an import from another file.
     * @see https://esbuild.github.io/api/#inject
     */
    inject?: string[];
    /**
     * Emit esbuild metafile
     * @see https://esbuild.github.io/api/#metafile
     */
    metafile?: boolean;
    footer?: BannerOrFooter;
    banner?: BannerOrFooter;
    /**
     * Target platform
     * @default `node`
     */
    platform?: 'node' | 'browser' | 'neutral';
    /**
     * Esbuild loader option
     */
    loader?: Record<string, Loader>;
    /**
     * Disable config file with `false`
     * Or pass a custom config filename
     */
    config?: boolean | string;
    /**
     * Use a custom tsconfig
     */
    tsconfig?: string;
    /**
     * Inject CSS as style tags to document head
     * @default {false}
     */
    injectStyle?: boolean | ((css: string, fileId: string) => string);
    /**
     * Inject cjs and esm shims if needed
     * @default false
     */
    shims?: boolean;
    /**
     * TSUP plugins
     * @experimental
     * @alpha
     */
    plugins?: Plugin[];
    /**
     * By default esbuild already does treeshaking
     *
     * But this option allow you to perform additional treeshaking with Rollup
     *
     * This can result in smaller bundle size
     */
    treeshake?: TreeshakingStrategy;
    /**
     * Copy the files inside `publicDir` to output directory
     */
    publicDir?: string | boolean;
    killSignal?: KILL_SIGNAL;
    /**
     * Interop default within `module.exports` in cjs
     * @default false
     */
    cjsInterop?: boolean;
};
interface NormalizedExperimentalDtsConfig {
    entry: {
        [entryAlias: string]: string;
    };
    compilerOptions?: any;
}
type NormalizedOptions = Omit<MarkRequired<Options, 'entry' | 'outDir'>, 'dts' | 'experimentalDts' | 'format'> & {
    dts?: DtsConfig;
    experimentalDts?: NormalizedExperimentalDtsConfig;
    tsconfigResolvePaths: Record<string, string[]>;
    tsconfigDecoratorMetadata?: boolean;
    format: Format[];
};

type MaybePromise<T> = T | Promise<T>;

declare const defineConfig: (options: Options | Options[] | ((overrideOptions: Options) => MaybePromise<Options | Options[]>)) => Options | Options[] | ((overrideOptions: Options) => MaybePromise<Options | Options[]>);
declare function build(_options: Options): Promise<void>;

export { Format, NormalizedOptions, Options, build, defineConfig };
