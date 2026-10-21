// Probe: webpack 5 (repo root) path separators.
// Runs real compilations (mode development, devtool false, target node, cache off) on a tiny fixture
// (entry.js -> ./a.js, ./sub/b.js; entry-alias.js -> '@sub/b.js') with a recording loader + plugin,
// and checks:
//   1. output: NormalModule resource/context, loader resourcePath/context/rootContext, compiler.context
//   2. input: `/`-form context, entry, output.path, resolve.alias (and what webpack reports back)
//   3. matching: Rule.include string (native vs `/` form) and RegExp (`/`-only vs `[\\/]`)
//   4. output: compilation.fileDependencies / contextDependencies storage of native vs `/` strings
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const LOADER_SOURCE = `module.exports = function probeLoader(source) {
  const o = this.getOptions() || {};
  (globalThis.__webpackProbeLog ||= []).push({
    tag: o.tag,
    resource: this.resource,
    resourcePath: this.resourcePath,
    context: this.context,
    rootContext: this.rootContext,
  });
  if (o.addDeps && /[\\\\/]b\\.js$/.test(this.resourcePath)) {
    for (const f of o.addDeps.files) this.addDependency(f);
    for (const d of o.addDeps.dirs) this.addContextDependency(d);
  }
  return source;
};
`;

export function versions(ctx) {
  return {
    webpack: ctx.packageVersion('webpack'),
    'enhanced-resolve': ctx.packageVersion('enhanced-resolve'),
    'loader-runner': ctx.packageVersion('loader-runner'),
    watchpack: ctx.packageVersion('watchpack'),
  };
}

export async function run(ctx) {
  const webpack = ctx.requireFrom()('webpack');
  const W = ctx.isWindows;
  const style = ctx.separatorStyle;
  const fwd = ctx.toForward;
  const SKIP = 'skipped-on-posix';

  // ---- fixture ------------------------------------------------------------------------------
  const srcDir = path.join(ctx.workDir, 'src');
  const subDir = path.join(srcDir, 'sub');
  mkdirSync(subDir, { recursive: true });
  const files = {
    entry: path.join(srcDir, 'entry.js'),
    entryAlias: path.join(srcDir, 'entry-alias.js'),
    a: path.join(srcDir, 'a.js'),
    b: path.join(subDir, 'b.js'),
  };
  writeFileSync(
    files.entry,
    "import a from './a.js';\nimport b from './sub/b.js';\nexport default a + b;\n"
  );
  writeFileSync(files.entryAlias, "import b from '@sub/b.js';\nexport default b;\n");
  writeFileSync(files.a, 'export default 1;\n');
  writeFileSync(files.b, 'export default 2;\n');
  const loaderPath = path.join(ctx.workDir, 'probe-loader.cjs');
  writeFileSync(loaderPath, LOADER_SOURCE);

  const base = (name) => path.basename(name.split('?')[0]);
  const raw = { workDir: ctx.workDir, files, loaderPath };

  /** Runs one compilation and returns everything the recording plugin and loader saw. */
  async function compile(name, { context, entry, outputPath, alias, rules, extraContextDep }) {
    globalThis.__webpackProbeLog = [];
    const rec = { name, input: { context, entry, outputPath, alias } };
    const plugin = {
      apply(compiler) {
        rec.compilerContext = compiler.context;
        compiler.hooks.afterCompile.tap('PathProbe', (compilation) => {
          if (extraContextDep) {
            compilation.contextDependencies.add(extraContextDep.dir);
            compilation.fileDependencies.add(extraContextDep.file);
          }
        });
        compiler.hooks.assetEmitted.tap('PathProbe', (file, info) => {
          (rec.emitted ||= []).push({
            file,
            outputPath: info.outputPath,
            targetPath: info.targetPath,
          });
        });
        compiler.hooks.done.tap('PathProbe', (stats) => {
          const c = stats.compilation;
          rec.compilerOutputPath = compiler.outputPath; // set by WebpackOptionsApply after plugins
          rec.modules = [...c.modules]
            .filter((m) => typeof m.resource === 'string')
            .map((m) => ({
              resource: m.resource,
              userRequest: m.userRequest,
              context: m.context,
              identifier: m.identifier(),
              id: c.chunkGraph.getModuleId(m),
            }));
          rec.fileDependencies = [...c.fileDependencies].filter(
            (p) =>
              p.toLowerCase().includes(fwd(ctx.workDir).toLowerCase()) ||
              p.toLowerCase().includes(ctx.workDir.toLowerCase())
          );
          rec.contextDependencies = [...c.contextDependencies].filter((p) =>
            fwd(p).toLowerCase().startsWith(fwd(ctx.workDir).toLowerCase())
          );
          rec.errors = c.errors.map((e) => String(e.message).slice(0, 500));
          rec.warnings = c.warnings.map((e) => String(e.message).slice(0, 300));
        });
      },
    };
    const compiler = webpack({
      mode: 'development',
      devtool: false,
      target: 'node',
      cache: false,
      context,
      entry,
      output: { path: outputPath, filename: '[name].js' },
      resolve: { alias },
      module: { rules },
      plugins: [plugin],
      infrastructureLogging: { level: 'none' },
    });
    try {
      await new Promise((resolve, reject) =>
        compiler.run((err) => (err ? reject(err) : resolve()))
      );
    } finally {
      await new Promise((resolve) => compiler.close(() => resolve()));
    }
    rec.loaderCalls = globalThis.__webpackProbeLog;
    return rec;
  }

  const findModule = (rec, file) => rec.modules?.find((m) => base(m.resource) === base(file));
  const loaderCallFor = (rec, file, tag) =>
    rec.loaderCalls.find((c) => base(c.resourcePath) === base(file) && (!tag || c.tag === tag));
  const allLoader = (extra = {}) => [
    {
      test: /\.js$/,
      use: [{ loader: loaderPath, options: { tag: 'all', ...extra } }],
    },
  ];

  // ---- 1 + 4: native inputs (baseline) -----------------------------------------------------
  let nat;
  try {
    const outNative = path.join(ctx.workDir, 'out-native');
    nat = await compile('native', {
      context: srcDir,
      entry: { main: './entry.js', alias: './entry-alias.js' },
      outputPath: outNative,
      alias: { '@sub': subDir },
      rules: allLoader({
        addDeps: { files: [fwd(files.a), files.a], dirs: [fwd(subDir)] },
      }),
      extraContextDep: { dir: fwd(srcDir), file: fwd(files.entry) },
    });
    raw.native = nat;
    const out = (id, claim, observed, notes) =>
      ctx.claim({
        id,
        claim,
        kind: 'output',
        expected: W ? 'backslash' : 'forward',
        observed,
        notes,
      });

    out(
      'webpack.output.module.resource',
      'NormalModule.resource of ./sub/b.js is native',
      style(findModule(nat, files.b)?.resource),
      'raw.native.modules'
    );
    out(
      'webpack.output.module.userRequest',
      'NormalModule.userRequest of ./sub/b.js is native',
      style(findModule(nat, files.b)?.userRequest),
      'raw.native.modules'
    );
    out(
      'webpack.output.module.context',
      'NormalModule.context (dirname of resource) is native',
      style(findModule(nat, files.b)?.context),
      'raw.native.modules'
    );
    out(
      'webpack.output.module.aliasResource',
      'resource of @sub/b.js resolved via native resolve.alias is native',
      style(findModule(nat, files.b)?.resource),
      'same module as ./sub/b.js; raw.native.modules'
    );
    out(
      'webpack.output.loader.resourcePath',
      'loader this.resourcePath is native',
      style(loaderCallFor(nat, files.b)?.resourcePath),
      'raw.native.loaderCalls'
    );
    out(
      'webpack.output.loader.context',
      'loader this.context is native',
      style(loaderCallFor(nat, files.b)?.context),
      'raw.native.loaderCalls'
    );
    out(
      'webpack.output.loader.rootContext',
      'loader this.rootContext is native (config context given native)',
      style(loaderCallFor(nat, files.b)?.rootContext),
      'equals options.context as given'
    );
    out(
      'webpack.output.compiler.context',
      'compiler.context is native (config context given native)',
      style(nat.compilerContext),
      'raw.native.compilerContext'
    );
    out(
      'webpack.output.emit.targetPath',
      'assetEmitted targetPath is native',
      style(nat.emitted?.[0]?.targetPath),
      'raw.native.emitted'
    );
    ctx.claim({
      id: 'webpack.output.moduleIds.named',
      claim:
        'development named module ids are relative `./`-style with forward slashes on every platform',
      kind: 'output',
      expected: 'forward',
      observed: style(String(findModule(nat, files.b)?.id)),
      notes: `id=${findModule(nat, files.b)?.id}`,
    });

    // 4. dependencies
    const depsFor = (list, p) =>
      list
        .filter((d) => fwd(d).toLowerCase() === fwd(p).toLowerCase())
        .map(style)
        .sort();
    ctx.claim({
      id: 'webpack.output.fileDependencies.native',
      claim: 'compilation.fileDependencies entries webpack adds itself (resolved files) are native',
      kind: 'output',
      expected: W ? 'backslash' : 'forward',
      observed: style(nat.fileDependencies.find((d) => base(d) === 'b.js')),
      notes: 'b.js is only added by webpack itself; raw.native.fileDependencies',
    });
    ctx.claim({
      id: 'webpack.output.fileDependencies.addDependencyForwardKeptVerbatim',
      claim:
        'this.addDependency(`/`-form) is stored verbatim next to the native entry (no normalization/dedup)',
      kind: 'output',
      expected: W ? ['backslash', 'forward'] : ['forward'],
      observed: depsFor(nat.fileDependencies, files.a),
      notes:
        'styles of all fileDependencies entries that denote a.js; two entries => watcher sees two distinct paths',
    });
    ctx.claim({
      id: 'webpack.output.fileDependencies.pluginForwardKeptVerbatim',
      claim:
        'compilation.fileDependencies.add(`/`-form) is stored verbatim next to the native entry',
      kind: 'output',
      expected: W ? ['backslash', 'forward'] : ['forward'],
      observed: depsFor(nat.fileDependencies, files.entry),
      notes: 'entry.js added natively by webpack and in `/` form by the plugin',
    });
    ctx.claim({
      id: 'webpack.output.contextDependencies.forwardKeptVerbatim',
      claim: 'addContextDependency / contextDependencies.add with `/`-form are stored verbatim',
      kind: 'output',
      expected: 'both `/`-form strings present verbatim',
      observed: {
        sub: depsFor(nat.contextDependencies, subDir),
        src: depsFor(nat.contextDependencies, srcDir),
      },
      check: (o) => o.sub.includes('forward') && o.src.includes('forward'),
      notes:
        'styles of entries denoting sub/ (loader addContextDependency) and src/ (plugin); a native twin, if webpack adds one, shows as an extra "backslash" on Windows',
    });
  } catch (error) {
    ctx.claimError({
      id: 'webpack.output.native-run',
      claim: 'native-input compilation',
      kind: 'output',
      expected: 'compiles',
      error,
    });
  }

  // ---- 2: `/`-form inputs ------------------------------------------------------------------
  try {
    const outFwd = path.join(ctx.workDir, 'out-forward');
    const f = await compile('forward', {
      context: fwd(srcDir),
      entry: { main: fwd(files.entry), alias: './entry-alias.js' },
      outputPath: fwd(outFwd),
      alias: { '@sub': fwd(subDir) },
      rules: allLoader(),
    });
    raw.forward = f;
    const inp = (id, claim, expected, observed, notes) =>
      ctx.claim({ id, claim, kind: 'input', expected, observed, notes });
    inp(
      'webpack.input.forward.compiles',
      '`/`-form context/entry/output.path/alias compile without errors',
      true,
      f.errors.length === 0,
      f.errors.join('\n') || undefined
    );
    inp(
      'webpack.input.forward.outputWritten',
      '`/`-form output.path: main.js written to disk',
      true,
      existsSync(path.join(outFwd, 'main.js'))
    );
    inp(
      'webpack.input.forward.aliasResolved',
      '`/`-form resolve.alias value resolves @sub/b.js',
      true,
      f.loaderCalls.some((c) => base(c.resourcePath) === 'b.js')
    );
    inp(
      'webpack.input.forward.compilerContext',
      'compiler.context keeps the `/` form as given (not normalized)',
      'forward',
      style(f.compilerContext),
      `raw: ${f.compilerContext}`
    );
    inp(
      'webpack.input.forward.compilerOutputPath',
      'compiler.outputPath keeps the `/` form as given',
      'forward',
      style(f.compilerOutputPath),
      `raw: ${f.compilerOutputPath}`
    );
    inp(
      'webpack.input.forward.rootContext',
      'loader this.rootContext keeps the `/` form as given',
      'forward',
      style(loaderCallFor(f, files.a)?.rootContext)
    );
    inp(
      'webpack.input.forward.resource',
      'resources resolved from a `/` context/entry are still native (enhanced-resolve win32-normalizes)',
      W ? 'backslash' : 'forward',
      style(findModule(f, files.a)?.resource),
      'a.js via ./a.js from `/` context'
    );
    inp(
      'webpack.input.forward.entryResource',
      'resource of a `/`-form absolute entry is native',
      W ? 'backslash' : 'forward',
      style(findModule(f, files.entry)?.resource)
    );
    inp(
      'webpack.input.forward.aliasResource',
      'resource resolved through a `/`-form alias is native',
      W ? 'backslash' : 'forward',
      style(findModule(f, files.b)?.resource)
    );
    inp(
      'webpack.input.forward.loaderContext',
      'loader this.context (dirname of resourcePath) is native',
      W ? 'backslash' : 'forward',
      style(loaderCallFor(f, files.b)?.context)
    );
    inp(
      'webpack.input.forward.emitTargetPath',
      'assetEmitted targetPath with `/` output.path',
      W ? 'backslash' : 'forward',
      style(f.emitted?.[0]?.targetPath),
      'webpack util/fs join -> path.win32.join for C:/ roots'
    );
    inp(
      'webpack.input.forward.moduleIdSame',
      'named module id of a.js is the same as with native inputs',
      findModule(nat ?? {}, files.a)?.id ?? 'native-run-failed',
      findModule(f, files.a)?.id
    );
  } catch (error) {
    ctx.claimError({
      id: 'webpack.input.forward-run',
      claim: '`/`-form inputs compile',
      kind: 'input',
      expected: true,
      error,
    });
  }

  if (W) {
    // Mixed: backslash context + `/` entry is the realistic case (process.cwd() + a hand-written path).
    try {
      const mixed = await compile('mixed', {
        context: srcDir,
        entry: { main: fwd(files.entry) },
        outputPath: path.join(ctx.workDir, 'out-mixed'),
        alias: {},
        rules: allLoader(),
      });
      raw.mixed = mixed;
      ctx.claim({
        id: 'webpack.input.mixed.compiles',
        claim: 'native context + `/` absolute entry compiles',
        kind: 'input',
        expected: true,
        observed: mixed.errors.length === 0,
        notes: mixed.errors.join('\n') || undefined,
      });
    } catch (error) {
      ctx.claimError({
        id: 'webpack.input.mixed.compiles',
        claim: 'native context + `/` absolute entry compiles',
        kind: 'input',
        expected: true,
        error,
      });
    }
  } else {
    ctx.claim({
      id: 'webpack.input.mixed.compiles',
      claim: 'native context + `/` absolute entry compiles',
      kind: 'input',
      expected: SKIP,
      observed: SKIP,
    });
  }

  // ---- 3: Rule.include matching ------------------------------------------------------------
  // One compilation, one rule per variant; each rule's loader carries a tag, so the log shows which
  // modules each condition matched. The resource tested is always the resolved (native) path.
  const variants = {
    stringNative: { include: subDir, expected: ['b.js'] },
    stringForward: { include: fwd(subDir), expected: W ? [] : ['b.js'] },
    stringForwardLowerDrive: W
      ? {
          include: fwd(subDir).replace(/^[A-Z]:/, (d) => d.toLowerCase()),
          expected: [],
        }
      : null,
    regexpForwardOnly: { include: /\/sub\//, expected: W ? [] : ['b.js'] },
    regexpEitherSeparator: { include: /[\\/]sub[\\/]/, expected: ['b.js'] },
    regexpBackslashOnly: W ? { include: /\\sub\\/, expected: ['b.js'] } : null,
  };
  try {
    const rules = Object.entries(variants)
      .filter(([, v]) => v)
      .map(([tag, v]) => ({
        include: v.include,
        use: [{ loader: loaderPath, options: { tag } }],
      }));
    const m = await compile('matching', {
      context: srcDir,
      entry: { main: './entry.js' },
      outputPath: path.join(ctx.workDir, 'out-matching'),
      alias: {},
      rules,
    });
    raw.matching = {
      ...m,
      conditions: Object.fromEntries(
        Object.entries(variants).map(([k, v]) => [k, v ? String(v.include) : SKIP])
      ),
    };
    for (const [tag, v] of Object.entries(variants)) {
      const id = `webpack.match.include.${tag}`;
      if (!v) {
        ctx.claim({
          id,
          claim: `Rule.include ${tag}`,
          kind: 'input',
          expected: SKIP,
          observed: SKIP,
        });
        continue;
      }
      ctx.claim({
        id,
        claim: `Rule.include ${String(v.include)} matches the native resource of sub/b.js`,
        kind: 'input',
        expected: v.expected,
        observed: [
          ...new Set(m.loaderCalls.filter((c) => c.tag === tag).map((c) => base(c.resourcePath))),
        ].sort(),
        notes: 'list = modules the rule loader ran on',
      });
    }
  } catch (error) {
    ctx.claimError({
      id: 'webpack.match.include',
      claim: 'Rule.include matching compilation',
      kind: 'input',
      expected: 'compiles',
      error,
    });
  }

  // Schema check: a `/`-form string is accepted as an absolute path by validation (regex
  // /^(?:[A-Za-z]:(\\|\/)|\\\\|\/)/), so a non-matching include is silent, not a config error.
  try {
    const errs = webpack.validate
      ? (() => {
          try {
            webpack.validate({ module: { rules: [{ include: fwd(subDir) }] } });
            return 'valid';
          } catch (e) {
            return String(e.message).slice(0, 300);
          }
        })()
      : 'no-validate';
    ctx.claim({
      id: 'webpack.input.include.forwardPassesSchema',
      claim: '`/`-form absolute include passes schema validation',
      kind: 'input',
      expected: 'valid',
      observed: errs,
    });
  } catch (error) {
    ctx.claimError({
      id: 'webpack.input.include.forwardPassesSchema',
      claim: '`/`-form include passes schema validation',
      kind: 'input',
      expected: 'valid',
      error,
    });
  }

  return raw;
}
