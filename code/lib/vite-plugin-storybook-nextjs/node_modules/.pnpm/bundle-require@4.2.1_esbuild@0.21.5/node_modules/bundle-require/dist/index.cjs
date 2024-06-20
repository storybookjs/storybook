"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  JS_EXT_RE: () => JS_EXT_RE,
  bundleRequire: () => bundleRequire,
  dynamicImport: () => dynamicImport,
  externalPlugin: () => externalPlugin,
  injectFileScopePlugin: () => injectFileScopePlugin,
  loadTsConfig: () => import_load_tsconfig.loadTsConfig,
  match: () => match,
  tsconfigPathsToRegExp: () => tsconfigPathsToRegExp
});
module.exports = __toCommonJS(src_exports);
var import_fs2 = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_url = require("url");
var import_esbuild = require("esbuild");
var import_load_tsconfig = require("load-tsconfig");

// src/utils.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var getPkgType = () => {
  try {
    const pkg = JSON.parse(
      import_fs.default.readFileSync(import_path.default.resolve("package.json"), "utf-8")
    );
    return pkg.type;
  } catch (error) {
  }
};
function guessFormat(inputFile) {
  if (!usingDynamicImport)
    return "cjs";
  const ext = import_path.default.extname(inputFile);
  const type = getPkgType();
  if (ext === ".js") {
    return type === "module" ? "esm" : "cjs";
  } else if (ext === ".ts" || ext === ".mts") {
    return "esm";
  } else if (ext === ".mjs") {
    return "esm";
  }
  return "cjs";
}
var usingDynamicImport = typeof jest === "undefined";
var dynamicImport = async (id, { format }) => {
  const fn = format === "esm" ? (file) => import(file) : false ? createRequire(import_meta.url) : require;
  return fn(id);
};
var getRandomId = () => {
  return Math.random().toString(36).substring(2, 15);
};

// src/index.ts
var DIRNAME_VAR_NAME = "__injected_dirname__";
var FILENAME_VAR_NAME = "__injected_filename__";
var IMPORT_META_URL_VAR_NAME = "__injected_import_meta_url__";
var JS_EXT_RE = /\.([mc]?[tj]s|[tj]sx)$/;
var PATH_NODE_MODULES_RE = /[\/\\]node_modules[\/\\]/;
function inferLoader(ext) {
  if (ext === ".mjs" || ext === ".cjs")
    return "js";
  if (ext === ".mts" || ext === ".cts")
    return "ts";
  return ext.slice(1);
}
var defaultGetOutputFile = (filepath, format) => filepath.replace(
  JS_EXT_RE,
  `.bundled_${getRandomId()}.${format === "esm" ? "mjs" : "cjs"}`
);
var tsconfigPathsToRegExp = (paths) => {
  return Object.keys(paths || {}).map((key) => {
    return new RegExp(`^${key.replace(/\*/, ".*")}$`);
  });
};
var match = (id, patterns) => {
  if (!patterns)
    return false;
  return patterns.some((p) => {
    if (p instanceof RegExp) {
      return p.test(id);
    }
    return id === p || id.startsWith(p + "/");
  });
};
var externalPlugin = ({
  external,
  notExternal,
  externalNodeModules = true
} = {}) => {
  return {
    name: "bundle-require:external",
    setup(ctx) {
      ctx.onResolve({ filter: /.*/ }, async (args) => {
        if (match(args.path, external)) {
          return {
            external: true
          };
        }
        if (match(args.path, notExternal)) {
          return;
        }
        if (externalNodeModules && args.path.match(PATH_NODE_MODULES_RE)) {
          const resolved = args.path[0] === "." ? import_path2.default.resolve(args.resolveDir, args.path) : args.path;
          return {
            path: (0, import_url.pathToFileURL)(resolved).toString(),
            external: true
          };
        }
        if (args.path[0] === "." || import_path2.default.isAbsolute(args.path)) {
          return;
        }
        return {
          external: true
        };
      });
    }
  };
};
var injectFileScopePlugin = () => {
  return {
    name: "bundle-require:inject-file-scope",
    setup(ctx) {
      ctx.initialOptions.define = {
        ...ctx.initialOptions.define,
        __dirname: DIRNAME_VAR_NAME,
        __filename: FILENAME_VAR_NAME,
        "import.meta.url": IMPORT_META_URL_VAR_NAME
      };
      ctx.onLoad({ filter: JS_EXT_RE }, async (args) => {
        const contents = await import_fs2.default.promises.readFile(args.path, "utf-8");
        const injectLines = [
          `const ${FILENAME_VAR_NAME} = ${JSON.stringify(args.path)};`,
          `const ${DIRNAME_VAR_NAME} = ${JSON.stringify(
            import_path2.default.dirname(args.path)
          )};`,
          `const ${IMPORT_META_URL_VAR_NAME} = ${JSON.stringify(
            (0, import_url.pathToFileURL)(args.path).href
          )};`
        ];
        return {
          contents: injectLines.join("") + contents,
          loader: inferLoader(import_path2.default.extname(args.path))
        };
      });
    }
  };
};
function bundleRequire(options) {
  return new Promise((resolve, reject) => {
    var _a, _b, _c, _d, _e;
    if (!JS_EXT_RE.test(options.filepath)) {
      throw new Error(`${options.filepath} is not a valid JS file`);
    }
    const preserveTemporaryFile = (_a = options.preserveTemporaryFile) != null ? _a : !!process.env.BUNDLE_REQUIRE_PRESERVE;
    const cwd = options.cwd || process.cwd();
    const format = (_b = options.format) != null ? _b : guessFormat(options.filepath);
    const tsconfig = (0, import_load_tsconfig.loadTsConfig)(cwd, options.tsconfig);
    const resolvePaths = tsconfigPathsToRegExp(
      ((_c = tsconfig == null ? void 0 : tsconfig.data.compilerOptions) == null ? void 0 : _c.paths) || {}
    );
    const extractResult = async (result) => {
      if (!result.outputFiles) {
        throw new Error(`[bundle-require] no output files`);
      }
      const { text } = result.outputFiles[0];
      const getOutputFile = options.getOutputFile || defaultGetOutputFile;
      const outfile = getOutputFile(options.filepath, format);
      await import_fs2.default.promises.writeFile(outfile, text, "utf8");
      let mod;
      const req = options.require || dynamicImport;
      try {
        mod = await req(
          format === "esm" ? (0, import_url.pathToFileURL)(outfile).href : outfile,
          { format }
        );
      } finally {
        if (!preserveTemporaryFile) {
          await import_fs2.default.promises.unlink(outfile);
        }
      }
      return {
        mod,
        dependencies: result.metafile ? Object.keys(result.metafile.inputs) : []
      };
    };
    const { watch: watchMode, ...restEsbuildOptions } = options.esbuildOptions || {};
    const esbuildOptions = {
      ...restEsbuildOptions,
      entryPoints: [options.filepath],
      absWorkingDir: cwd,
      outfile: "out.js",
      format,
      platform: "node",
      sourcemap: "inline",
      bundle: true,
      metafile: true,
      write: false,
      plugins: [
        ...((_d = options.esbuildOptions) == null ? void 0 : _d.plugins) || [],
        externalPlugin({
          external: options.external,
          notExternal: [
            ...options.notExternal || [],
            ...resolvePaths
          ],
          externalNodeModules: (_e = options.externalNodeModules) != null ? _e : !options.filepath.match(PATH_NODE_MODULES_RE)
        }),
        injectFileScopePlugin()
      ]
    };
    const run = async () => {
      if (!(watchMode || options.onRebuild)) {
        const result = await (0, import_esbuild.build)(esbuildOptions);
        resolve(await extractResult(result));
      } else {
        const rebuildCallback = typeof watchMode === "object" && typeof watchMode.onRebuild === "function" ? watchMode.onRebuild : async (error, result) => {
          var _a2, _b2;
          if (error) {
            (_a2 = options.onRebuild) == null ? void 0 : _a2.call(options, { err: error });
          }
          if (result) {
            (_b2 = options.onRebuild) == null ? void 0 : _b2.call(options, await extractResult(result));
          }
        };
        const onRebuildPlugin = () => {
          return {
            name: "bundle-require:on-rebuild",
            setup(ctx2) {
              let count = 0;
              ctx2.onEnd(async (result) => {
                if (count++ === 0) {
                  if (result.errors.length === 0)
                    resolve(await extractResult(result));
                } else {
                  if (result.errors.length > 0) {
                    return rebuildCallback(
                      { errors: result.errors, warnings: result.warnings },
                      null
                    );
                  }
                  if (result) {
                    rebuildCallback(null, result);
                  }
                }
              });
            }
          };
        };
        esbuildOptions.plugins.push(onRebuildPlugin());
        const ctx = await (0, import_esbuild.context)(esbuildOptions);
        await ctx.watch();
      }
    };
    run().catch(reject);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  JS_EXT_RE,
  bundleRequire,
  dynamicImport,
  externalPlugin,
  injectFileScopePlugin,
  loadTsConfig,
  match,
  tsconfigPathsToRegExp
});
