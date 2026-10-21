// Probes esbuild (repo root version) path separators:
// - onResolve importer/resolveDir and onLoad path, outputFiles[].path, metafile keys (outputs)
// - entryPoints / absWorkingDir / outdir / alias given in `\` vs `/` form (inputs)
// - an onResolve plugin returning a `/`-form absolute path: what onLoad receives
// - transformSync `sourcefile` passthrough (source map `sources`, error `location.file`)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function versions(ctx) {
  return { esbuild: ctx.packageVersion('esbuild') };
}

const ALIAS = '@poc-alias/target';

function writeFixture(dir) {
  mkdirSync(path.join(dir, 'sub'), { recursive: true });
  writeFileSync(
    path.join(dir, 'entry.ts'),
    `import { a } from './a.ts';\nimport { b } from './sub/b.ts';\nexport const out: string = a + b;\n`
  );
  writeFileSync(
    path.join(dir, 'a.ts'),
    `import { t } from '${ALIAS}';\nimport { b } from './sub/b.ts';\nexport const a: string = 'a' + t + b;\n`
  );
  writeFileSync(
    path.join(dir, 'sub', 'b.ts'),
    `import { c } from './c.ts';\nexport const b: string = 'b' + c;\n`
  );
  writeFileSync(path.join(dir, 'sub', 'c.ts'), `export const c: string = 'c';\n`);
  writeFileSync(path.join(dir, 'sub', 'alias-target.ts'), `export const t: string = 't';\n`);
}

/** Records every onResolve/onLoad call. `rewrite(args)` may return an onResolve result. */
function recorder(rewrite) {
  const log = { resolves: [], loads: [] };
  const plugin = {
    name: 'poc-recorder',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        log.resolves.push({
          path: args.path,
          importer: args.importer,
          resolveDir: args.resolveDir,
          namespace: args.namespace,
          kind: args.kind,
        });
        return rewrite?.(args) ?? undefined;
      });
      build.onLoad({ filter: /.*/ }, (args) => {
        log.loads.push({ path: args.path, namespace: args.namespace });
        return undefined;
      });
    },
  };
  return { log, plugin };
}

/** Separator styles of a list of strings, deduplicated and sorted (e.g. ['backslash']). */
const styles = (ctx, values) => [...new Set(values.filter(Boolean).map(ctx.separatorStyle))].sort();

export async function run(ctx) {
  const esbuild = ctx.requireFrom()('esbuild');
  const dir = ctx.workDir;
  writeFixture(dir);
  const native = (p) => path.join(dir, p);
  const nativeStyle = ctx.isWindows ? 'backslash' : 'forward';
  const raw = { workDir: dir, builds: {} };

  const baseOptions = (form = (p) => p) => ({
    entryPoints: [form(native('entry.ts'))],
    absWorkingDir: form(dir),
    outdir: form(native('out')),
    alias: { [ALIAS]: form(native('sub/alias-target.ts')) },
    bundle: true,
    write: false,
    metafile: true,
    format: 'esm',
    logLevel: 'silent',
  });

  async function build(name, options, rewrite) {
    const { log, plugin } = recorder(rewrite);
    try {
      const result = await esbuild.build({ ...options, plugins: [plugin] });
      const rec = {
        ok: true,
        options: { ...options },
        resolves: log.resolves,
        loads: log.loads,
        outputFiles: result.outputFiles.map((f) => f.path),
        metafileInputs: Object.keys(result.metafile.inputs),
        metafileOutputs: Object.keys(result.metafile.outputs),
      };
      raw.builds[name] = rec;
      return rec;
    } catch (error) {
      const rec = {
        ok: false,
        options: { ...options },
        error: String(error?.message ?? error),
        resolves: log.resolves,
        loads: log.loads,
      };
      raw.builds[name] = rec;
      return rec;
    }
  }

  // --- Claims 1-3: outputs of a build with native inputs -------------------------------------
  try {
    const r = await build('native', baseOptions());
    if (!r.ok) throw new Error(r.error);
    const fileLoads = r.loads.filter((l) => l.namespace === 'file');
    const importers = r.resolves.map((x) => x.importer).filter(Boolean);
    ctx.claim({
      id: 'esbuild.onResolve.importer',
      claim: 'onResolve args.importer is an absolute native path',
      kind: 'output',
      expected: { styles: [nativeStyle], allAbsolute: true },
      observed: {
        styles: styles(ctx, importers),
        allAbsolute: importers.every((p) => path.isAbsolute(p)),
      },
      notes: 'raw.builds.native.resolves',
    });
    const resolveDirs = r.resolves.map((x) => x.resolveDir);
    ctx.claim({
      id: 'esbuild.onResolve.resolveDir',
      claim: 'onResolve args.resolveDir is an absolute native path (also for entry points)',
      kind: 'output',
      expected: { styles: [nativeStyle], allAbsolute: true },
      observed: {
        styles: styles(ctx, resolveDirs),
        allAbsolute: resolveDirs.every((p) => path.isAbsolute(p)),
      },
      notes: 'raw.builds.native.resolves',
    });
    ctx.claim({
      id: 'esbuild.onLoad.path',
      claim: 'onLoad args.path (file namespace) is an absolute native path',
      kind: 'output',
      expected: { styles: [nativeStyle], allAbsolute: true, count: 5 },
      observed: {
        styles: styles(
          ctx,
          fileLoads.map((l) => l.path)
        ),
        allAbsolute: fileLoads.every((l) => path.isAbsolute(l.path)),
        count: fileLoads.length,
      },
      notes: 'raw.builds.native.loads',
    });
    ctx.claim({
      id: 'esbuild.outputFiles.path',
      claim: 'outputFiles[].path is an absolute native path',
      kind: 'output',
      expected: [path.join(dir, 'out', 'entry.js')],
      observed: r.outputFiles,
      notes: `expected style ${nativeStyle}; raw.builds.native.outputFiles`,
    });
    ctx.claim({
      id: 'esbuild.metafile.keys',
      claim:
        'metafile inputs/outputs keys are relative to absWorkingDir and use "/" on every platform',
      kind: 'output',
      expected: {
        inputs: ['a.ts', 'entry.ts', 'sub/alias-target.ts', 'sub/b.ts', 'sub/c.ts'],
        outputs: ['out/entry.js'],
      },
      observed: { inputs: [...r.metafileInputs].sort(), outputs: [...r.metafileOutputs].sort() },
      notes: 'raw.builds.native.metafileInputs / metafileOutputs',
    });
  } catch (error) {
    for (const id of [
      'onResolve.importer',
      'onResolve.resolveDir',
      'onLoad.path',
      'outputFiles.path',
      'metafile.keys',
    ]) {
      ctx.claimError({
        id: `esbuild.${id}`,
        claim: 'native build outputs',
        kind: 'output',
        expected: null,
        error,
      });
    }
  }

  // Extra observation: absPaths: ['metafile'] keys (source keeps PrettyPaths.Abs un-normalized).
  try {
    const r = await build('absPathsMetafile', { ...baseOptions(), absPaths: ['metafile'] });
    if (!r.ok) throw new Error(r.error);
    ctx.claim({
      id: 'esbuild.metafile.absPaths',
      claim:
        "with absPaths: ['metafile'], metafile keys are absolute native paths (no '/' normalization)",
      kind: 'output',
      expected: { inputStyles: [nativeStyle], outputStyles: [nativeStyle] },
      observed: {
        inputStyles: styles(ctx, r.metafileInputs),
        outputStyles: styles(ctx, r.metafileOutputs),
      },
      notes:
        'raw.builds.absPathsMetafile; prediction from source (MakePrettyPaths only slash-normalizes Rel)',
    });
  } catch (error) {
    ctx.claimError({
      id: 'esbuild.metafile.absPaths',
      claim: 'absPaths metafile',
      kind: 'output',
      expected: null,
      error,
    });
  }

  // --- Claim 4: input forms --------------------------------------------------------------------
  // `backslash` is the native form on Windows and not a path on POSIX (skipped there).
  const forms = {
    backslash: ctx.isWindows ? (p) => ctx.toBackslash(p) : null,
    forward: (p) => ctx.toForward(p),
  };
  const variants = {
    all: ['entryPoints', 'absWorkingDir', 'outdir', 'alias'],
    entryPoints: ['entryPoints'],
    absWorkingDir: ['absWorkingDir'],
    outdir: ['outdir'],
    alias: ['alias'],
  };
  for (const [formName, form] of Object.entries(forms)) {
    for (const [variant, keys] of Object.entries(variants)) {
      const id = `esbuild.input.${variant}.${formName}`;
      const claim = `${keys.join(', ')} accept${keys.length > 1 ? '' : 's'} the ${formName === 'forward' ? '"/"' : '"\\"'} form`;
      if (!form) {
        ctx.claim({
          id,
          claim,
          kind: 'input',
          expected: 'skipped-on-posix',
          observed: 'skipped-on-posix',
        });
        continue;
      }
      try {
        const formed = baseOptions(form);
        const options = baseOptions();
        for (const key of keys) options[key] = formed[key];
        const r = await build(`${variant}.${formName}`, options);
        const fileLoads = r.loads.filter((l) => l.namespace === 'file').map((l) => l.path);
        ctx.claim({
          id,
          claim,
          kind: 'input',
          // Prediction: accepted; esbuild cleans file paths it resolves itself, so the formats of
          // outputs do not depend on the input form.
          expected: {
            ok: true,
            onLoadStyles: [nativeStyle],
            outputFileStyles: [nativeStyle],
            metafileInputStyles: ['forward', 'none'],
            metafileInputCount: 5,
          },
          observed: r.ok
            ? {
                ok: true,
                onLoadStyles: styles(ctx, fileLoads),
                outputFileStyles: styles(ctx, r.outputFiles),
                metafileInputStyles: styles(ctx, r.metafileInputs),
                metafileInputCount: r.metafileInputs.length,
              }
            : { ok: false, error: r.error },
          notes: `raw.builds["${variant}.${formName}"]`,
        });
      } catch (error) {
        ctx.claimError({ id, claim, kind: 'input', expected: true, error });
      }
    }
  }

  // --- Claim 5: onResolve returns a "/"-form absolute path ------------------------------------
  // Only the entry's import of ./sub/b.ts is rewritten; a.ts imports the same file normally,
  // so this also shows whether the two spellings are deduplicated into one module.
  try {
    const entryNative = native('entry.ts');
    const bForward = ctx.toForward(native('sub/b.ts'));
    const r = await build('pluginForwardPath', baseOptions(), (args) =>
      args.path === './sub/b.ts' && args.importer === entryNative ? { path: bForward } : undefined
    );
    if (!r.ok) throw new Error(r.error);
    const bLoads = r.loads.filter((l) => /[\\/]sub[\\/]b\.ts$/.test(l.path)).map((l) => l.path);
    const cResolve = r.resolves.find((x) => x.path === './c.ts');
    ctx.claim({
      id: 'esbuild.plugin.forwardPathKept',
      claim:
        'onLoad receives a plugin-returned "/" path verbatim (not normalized); both spellings dedupe to one module',
      kind: 'input',
      // Prediction from source: RunOnResolvePlugins only checks IsAbs, no Clean; visited key is
      // lowercase + "\"->"/", so both spellings map to one module. Which spelling wins on Windows
      // depends on which import is resolved first (entry's import is first in practice).
      expected: { bLoadCount: 1, bLoadPaths: [bForward], bMetafileKeys: ['sub/b.ts'] },
      observed: {
        bLoadCount: bLoads.length,
        bLoadPaths: bLoads,
        bMetafileKeys: r.metafileInputs.filter((k) => /b\.ts$/.test(k)),
      },
      check: (o) =>
        o.bLoadCount === 1 && o.bMetafileKeys.length === 1 && o.bMetafileKeys[0] === 'sub/b.ts',
      notes:
        'check only requires dedupe + "/" metafile key; bLoadPaths shows kept vs normalized. raw.builds.pluginForwardPath',
    });
    ctx.claim({
      id: 'esbuild.plugin.forwardPath.childImporter',
      claim:
        "for a module loaded from a plugin-returned '/' path, children's importer keeps '/' and resolveDir is native",
      kind: 'output',
      expected: ctx.isWindows
        ? { importerStyle: 'forward', resolveDirStyle: 'backslash' }
        : { importerStyle: 'forward', resolveDirStyle: 'forward' },
      observed: {
        importerStyle: ctx.separatorStyle(cResolve?.importer),
        resolveDirStyle: ctx.separatorStyle(cResolve?.resolveDir),
      },
      notes:
        'only meaningful if the forward spelling won (see bLoadPaths); resolveDir = fs.Dir(path) which cleans',
    });
  } catch (error) {
    ctx.claimError({
      id: 'esbuild.plugin.forwardPathKept',
      claim: 'plugin "/" path',
      kind: 'input',
      expected: null,
      error,
    });
    ctx.claimError({
      id: 'esbuild.plugin.forwardPath.childImporter',
      claim: 'plugin "/" path',
      kind: 'output',
      expected: null,
      error,
    });
  }

  // --- Claim 6: transformSync sourcefile -------------------------------------------------------
  const sourcefiles = {
    native: native('sub/b.ts'),
    forward: ctx.toForward(native('sub/b.ts')),
    backslash: ctx.toBackslash(native('sub/b.ts')), // just a string; sourcefile is never resolved
  };
  raw.transform = {};
  for (const [name, sourcefile] of Object.entries(sourcefiles)) {
    const id = `esbuild.transformSync.sourcefile.${name}`;
    try {
      const ok = esbuild.transformSync('export const x: number = 1;', {
        loader: 'ts',
        sourcefile,
        sourcemap: 'external',
      });
      let errorFile = null;
      try {
        esbuild.transformSync('export const = ;', { loader: 'ts', sourcefile, logLevel: 'silent' });
      } catch (e) {
        errorFile = e?.errors?.[0]?.location?.file ?? null;
      }
      const mapSources = JSON.parse(ok.map).sources;
      raw.transform[name] = { sourcefile, mapSources, errorFile };
      ctx.claim({
        id,
        claim: `transformSync sourcefile (${name} form) appears unchanged in map.sources and error location.file`,
        kind: 'input',
        expected: { mapSources: [sourcefile], errorFile: sourcefile },
        observed: { mapSources, errorFile },
        notes: 'raw.transform',
      });
    } catch (error) {
      ctx.claimError({
        id,
        claim: 'transformSync sourcefile',
        kind: 'input',
        expected: sourcefile,
        error,
      });
    }
  }
  // What code/core/src/bin/loader.ts actually does: no sourcefile option at all.
  try {
    const loaderSrc = readFileSync(path.join(ctx.REPO_ROOT, 'code/core/src/bin/loader.ts'), 'utf8');
    const ok = esbuild.transformSync('export const x: number = 1;', {
      loader: 'ts',
      sourcemap: 'external',
    });
    raw.transform.loaderTsDefault = { mapSources: JSON.parse(ok.map).sources };
    ctx.claim({
      id: 'esbuild.transformSync.loaderTs',
      claim: 'code/core/src/bin/loader.ts passes no sourcefile, so esbuild uses "<stdin>"',
      kind: 'output',
      expected: { loaderPassesSourcefile: false, defaultSources: ['<stdin>'] },
      observed: {
        loaderPassesSourcefile: /sourcefile/.test(loaderSrc),
        defaultSources: JSON.parse(ok.map).sources,
      },
    });
  } catch (error) {
    ctx.claimError({
      id: 'esbuild.transformSync.loaderTs',
      claim: 'loader.ts sourcefile',
      kind: 'output',
      expected: null,
      error,
    });
  }

  return raw;
}
