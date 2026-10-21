// Vite (repo root, 7.x): which separators plugin hooks see in `build()` and in a middleware-mode
// dev server (`ssrLoadModule`), which root/input/alias forms Vite accepts, whether Vite rewrites
// ids returned by a plugin's `resolveId`, and what the exported `normalizePath` does.
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function versions(ctx) {
  return { vite: ctx.packageVersion('vite'), rollup: ctx.packageVersion('rollup') };
}

const WIN_ABS = /^[A-Za-z]:\//;

export async function run(ctx) {
  const vite = await ctx.importFrom('vite');
  const raw = { builds: {}, dev: {}, normalizePath: {} };
  const native = (p) => (ctx.isWindows ? ctx.toBackslash(p) : p);
  const fwd = ctx.toForward;

  // Fixture: index.js -> ./a.js, ./sub/b.js; a.js -> '@sub/b.js' (alias) so alias forms are exercised.
  const proj = path.join(realpathSync(ctx.workDir), 'project');
  mkdirSync(path.join(proj, 'sub'), { recursive: true });
  writeFileSync(
    path.join(proj, 'index.js'),
    "import { a } from './a.js';\nimport { b } from './sub/b.js';\nexport default a + b;\n"
  );
  writeFileSync(
    path.join(proj, 'a.js'),
    "import { b } from '@sub/b.js';\nexport const a = 'a' + b;\n"
  );
  writeFileSync(path.join(proj, 'sub', 'b.js'), "export const b = 'b';\n");
  const files = { proj, index: path.join(proj, 'index.js'), sub: path.join(proj, 'sub') };
  const expectedIds = ['index.js', 'a.js', 'sub/b.js'].map((f) => fwd(path.join(proj, f)));
  raw.fixture = { proj, expectedIds };

  // Absolute, `/`-separated, with the drive letter kept on Windows.
  const isViteId = (id) =>
    typeof id === 'string' &&
    !id.includes('\\') &&
    (ctx.isWindows ? WIN_ABS.test(id) : id.startsWith('/'));
  const fixtureIds = (ids) =>
    ids.filter(
      (id) => typeof id === 'string' && fwd(id).toLowerCase().startsWith(fwd(proj).toLowerCase())
    );
  const styles = (ids) => [...new Set(ids.map(ctx.separatorStyle))].sort();

  /** A plugin that records every id it is shown. `extra` lets a variant add a resolveId. */
  function recorder(rec, extraResolveId) {
    return {
      name: 'poc-recorder',
      enforce: 'pre',
      configResolved(config) {
        rec.configRoot = config.root;
      },
      resolveId(source, importer) {
        rec.resolveId.push({ source, importer: importer ?? null });
        return extraResolveId ? extraResolveId(source, importer) : null;
      },
      load(id) {
        rec.load.push(id);
        return null;
      },
      transform(_code, id) {
        rec.transform.push(id);
        const info = this.getModuleInfo(id);
        rec.moduleInfoIds.push(info ? info.id : null);
        return null;
      },
      buildEnd() {
        // In dev this runs on server.close(); the dev graph is read from moduleGraph instead.
        if (typeof this.getModuleIds === 'function') rec.graphIds = [...this.getModuleIds()];
      },
    };
  }
  const newRec = () => ({
    configRoot: null,
    resolveId: [],
    load: [],
    transform: [],
    moduleInfoIds: [],
    graphIds: [],
  });

  async function doBuild({ root, input, alias, extraResolveId }) {
    const rec = newRec();
    const out = await vite.build({
      root,
      configFile: false,
      logLevel: 'silent',
      envFile: false,
      resolve: { alias: { '@sub': alias } },
      plugins: [recorder(rec, extraResolveId)],
      build: { write: false, minify: false, modulePreload: false, rollupOptions: { input } },
    });
    const output = (Array.isArray(out) ? out[0] : out).output;
    rec.chunkModuleIds = output
      .filter((o) => o.type === 'chunk')
      .flatMap((c) => Object.keys(c.modules));
    rec.code = output.find((o) => o.type === 'chunk')?.code ?? null;
    return rec;
  }

  // ---- Build: baseline with everything in `/` form ----------------------------------------
  const forwardCfg = { root: fwd(files.proj), input: fwd(files.index), alias: fwd(files.sub) };
  let base;
  try {
    base = await doBuild(forwardCfg);
    raw.builds.forward = base;
    const ids = fixtureIds([
      ...base.resolveId.map((r) => r.importer).filter(Boolean),
      ...base.load,
      ...base.transform,
      ...base.moduleInfoIds,
      ...base.graphIds,
    ]);
    ctx.claim({
      id: 'vite.build.hookIds.style',
      claim:
        'build(): resolveId importer, load/transform id, getModuleInfo().id, getModuleIds() are `/`-separated',
      kind: 'output',
      expected: ['forward'],
      observed: styles(ids),
      notes: 'raw.builds.forward has every recorded id',
    });
    ctx.claim({
      id: 'vite.build.hookIds.absoluteWithVolume',
      claim: 'build(): fixture ids are absolute, `/`-separated, drive letter kept on Windows',
      kind: 'output',
      expected: true,
      observed: ids.length > 0 && ids.every(isViteId),
    });
    ctx.claim({
      id: 'vite.build.hookIds.equalToForwardPath',
      claim:
        'build(): the module graph ids are exactly toForward(native realpath) of the 3 fixture files',
      kind: 'output',
      expected: [...expectedIds].sort(),
      observed: [...new Set(fixtureIds(base.graphIds))].sort(),
      notes: 'Windows drive-letter case may differ (realpath); compare raw values if this fails',
    });
    ctx.claim({
      id: 'vite.config.root.style',
      claim: 'configResolved: config.root is `/`-separated (root given in `/` form)',
      kind: 'output',
      expected: 'forward',
      observed: ctx.separatorStyle(base.configRoot),
      notes: `raw: ${base.configRoot}`,
    });
  } catch (error) {
    ctx.claimError({
      id: 'vite.build.hookIds.style',
      claim: 'build() with `/`-form config',
      kind: 'output',
      expected: ['forward'],
      error,
    });
  }

  // ---- Build: each input given in native `\` form (Windows only) ----------------------------
  const nativeVariants = {
    root: { ...forwardCfg, root: native(files.proj) },
    input: { ...forwardCfg, input: native(files.index) },
    alias: { ...forwardCfg, alias: native(files.sub) },
  };
  for (const [name, cfg] of Object.entries(nativeVariants)) {
    const id = `vite.build.accepts.${name}.native`;
    const claim = `build() accepts ${name === 'input' ? 'build.rollupOptions.input' : name === 'alias' ? 'resolve.alias replacement' : 'root'} in native \`\\\` form and resolves the same 3 modules`;
    if (!ctx.isWindows) {
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
      const rec = await doBuild(cfg);
      raw.builds[`native-${name}`] = rec;
      const graph = [...new Set(fixtureIds(rec.graphIds))].sort();
      ctx.claim({
        id,
        claim,
        kind: 'input',
        expected: { ok: true, sameModulesAsForward: true, styles: ['forward'] },
        observed: {
          ok: true,
          sameModulesAsForward:
            JSON.stringify(graph) ===
            JSON.stringify([...new Set(fixtureIds(base?.graphIds ?? []))].sort()),
          styles: styles(fixtureIds([...rec.load, ...rec.transform, ...rec.graphIds])),
        },
        notes: `graph: ${JSON.stringify(graph)}`,
      });
      if (name === 'root') {
        ctx.claim({
          id: 'vite.config.root.fromNative',
          claim:
            'configResolved: config.root is `/`-separated even when root was passed in native `\\` form',
          kind: 'output',
          expected: 'forward',
          observed: ctx.separatorStyle(rec.configRoot),
          notes: `raw: ${rec.configRoot}`,
        });
      }
    } catch (error) {
      ctx.claimError({ id, claim, kind: 'input', expected: { ok: true }, error });
      if (name === 'root') {
        ctx.claimError({
          id: 'vite.config.root.fromNative',
          claim: 'config.root from native root',
          kind: 'output',
          expected: 'forward',
          error,
        });
      }
    }
  }
  if (!ctx.isWindows) {
    ctx.claim({
      id: 'vite.config.root.fromNative',
      claim:
        'configResolved: config.root is `/`-separated even when root was passed in native `\\` form',
      kind: 'output',
      expected: 'skipped-on-posix',
      observed: 'skipped-on-posix',
    });
  }

  // ---- Plugin-returned ids: does Vite rewrite them? -----------------------------------------
  // `./sub/b.js` imported from index.js is resolved by our plugin to a non-normalized id:
  //  - Windows: native `\` form (the claim under test)
  //  - all platforms: `/`-form with a `/./` segment, a posix-observable proxy for normalizePath()
  //    (posix.normalize) being applied or not.
  const bAbs = path.join(files.sub, 'b.js');
  const returnedForms = {
    dotSegment: fwd(path.join(files.proj, 'sub')) + '/./b.js',
    ...(ctx.isWindows ? { native: ctx.toBackslash(bAbs) } : {}),
  };
  const pluginResolve = (form) => (source, importer) =>
    source === './sub/b.js' && importer && /index\.js$/.test(importer) ? form : null;
  const seenFor = (rec) => {
    const isB = (id) => typeof id === 'string' && /b\.js$/.test(id);
    return {
      load: rec.load.filter(isB),
      transform: rec.transform.filter(isB),
      graph: [...new Set((rec.devGraphIds ?? rec.graphIds).filter(isB))],
    };
  };

  // Prediction from source: build goes through Rollup, which keeps plugin ids untouched (docs:
  // "Rollup keeps resolved paths untouched"); dev goes through Vite's pluginContainer.resolveId,
  // which applies normalizePath() to the returned id (pluginContainer.ts L466 at v7.3.6).
  for (const [form, returned] of Object.entries({
    dotSegment: returnedForms.dotSegment,
    native: returnedForms.native,
  })) {
    const id = `vite.build.pluginReturnedId.${form}`;
    const claim = `build(): id returned by a plugin resolveId (${form}) reaches load/transform unchanged (no normalization)`;
    if (returned === undefined) {
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
      const rec = await doBuild({ ...forwardCfg, extraResolveId: pluginResolve(returned) });
      const seen = seenFor(rec);
      raw.builds[`pluginReturned-${form}`] = { returned, seen, all: rec };
      ctx.claim({
        id,
        claim,
        kind: 'input',
        expected: { loadSawReturned: true, transformSawReturned: true, bModulesInGraph: 2 },
        observed: {
          loadSawReturned: seen.load.includes(returned),
          transformSawReturned: seen.transform.includes(returned),
          bModulesInGraph: seen.graph.length,
        },
        notes: `returned ${JSON.stringify(returned)}; b.js ids seen: ${JSON.stringify(seen)}. 2 modules = duplicate of the alias-resolved b.js`,
      });
    } catch (error) {
      ctx.claimError({ id, claim, kind: 'input', expected: { loadSawReturned: true }, error });
    }
  }

  // ---- Dev server (middleware mode) + ssrLoadModule -----------------------------------------
  async function devRun(extraResolveId) {
    const rec = newRec();
    const server = await vite.createServer({
      root: fwd(files.proj),
      configFile: false,
      logLevel: 'silent',
      envFile: false,
      appType: 'custom',
      resolve: { alias: { '@sub': fwd(files.sub) } },
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      plugins: [recorder(rec, extraResolveId)],
    });
    try {
      const mod = await server.ssrLoadModule('/index.js');
      rec.moduleDefault = mod.default;
      const graph = server.environments.ssr.moduleGraph;
      rec.devGraphIds = [...graph.idToModuleMap.keys()];
      rec.graphFiles = [...graph.idToModuleMap.values()].map((m) => m.file);
    } finally {
      await server.close();
    }
    return rec;
  }

  try {
    const rec = await devRun();
    raw.dev.forward = rec;
    const fixtureImporters = fixtureIds(rec.resolveId.map((r) => r.importer).filter(Boolean));
    const ids = fixtureIds([
      ...rec.load,
      ...rec.transform,
      ...rec.moduleInfoIds,
      ...rec.devGraphIds,
      ...rec.graphFiles,
    ]);
    ctx.claim({
      id: 'vite.dev.hookIds.style',
      claim:
        'dev ssrLoadModule: load/transform id, getModuleInfo().id, moduleGraph ids/files are `/`-separated',
      kind: 'output',
      expected: ['forward'],
      observed: styles(ids),
    });
    ctx.claim({
      id: 'vite.dev.hookIds.absoluteWithVolume',
      claim: 'dev: fixture ids are absolute, `/`-separated, drive letter kept on Windows',
      kind: 'output',
      expected: true,
      observed: ids.length > 0 && ids.every(isViteId),
    });
    // Source: pluginContainer.resolveId defaults importer to node:path join(root, 'index.html'),
    // which yields `\` on Windows for top-level urls (here '/index.js').
    const entryImporter = rec.resolveId.find((r) => r.source === '/index.js')?.importer ?? null;
    ctx.claim({
      id: 'vite.dev.resolveId.entryImporter',
      claim:
        'dev: importer passed to resolveId for a top-level url is the default join(root, "index.html")',
      kind: 'output',
      expected: ctx.isWindows ? 'mixed-or-backslash' : 'forward',
      observed: ctx.separatorStyle(entryImporter),
      check: (o) => (ctx.isWindows ? o === 'backslash' || o === 'mixed' : o === 'forward'),
      notes: `raw: ${entryImporter}. Prediction from source (node:path join on win32), contradicts "always /"`,
    });
    ctx.claim({
      id: 'vite.dev.resolveId.importer.style',
      claim: 'dev: resolveId importer for imports inside modules is `/`-separated',
      kind: 'output',
      expected: ['forward'],
      observed: styles(
        rec.resolveId.filter((r) => r.source !== '/index.js' && r.importer).map((r) => r.importer)
      ),
      notes: `fixture importers: ${JSON.stringify([...new Set(fixtureImporters)])}`,
    });
  } catch (error) {
    ctx.claimError({
      id: 'vite.dev.hookIds.style',
      claim: 'dev ssrLoadModule',
      kind: 'output',
      expected: ['forward'],
      error,
    });
  }

  for (const [form, returned] of Object.entries({
    dotSegment: returnedForms.dotSegment,
    native: returnedForms.native,
  })) {
    const id = `vite.dev.pluginReturnedId.${form}`;
    const claim = `dev: id returned by a plugin resolveId (${form}) is normalized (normalizePath) before load/transform`;
    if (returned === undefined) {
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
      const rec = await devRun(pluginResolve(returned));
      const seen = seenFor(rec);
      const normalized = vite.normalizePath(returned);
      raw.dev[`pluginReturned-${form}`] = { returned, normalized, seen };
      ctx.claim({
        id,
        claim,
        kind: 'input',
        expected: { loadSaw: 'normalized', transformSaw: 'normalized', bModulesInGraph: 1 },
        observed: {
          loadSaw: seen.load.includes(normalized)
            ? 'normalized'
            : seen.load.includes(returned)
              ? 'returned'
              : seen.load,
          transformSaw: seen.transform.includes(normalized)
            ? 'normalized'
            : seen.transform.includes(returned)
              ? 'returned'
              : seen.transform,
          bModulesInGraph: seen.graph.length,
        },
        notes: `returned ${JSON.stringify(returned)} -> normalizePath ${JSON.stringify(normalized)}`,
      });
    } catch (error) {
      ctx.claimError({ id, claim, kind: 'input', expected: { loadSaw: 'normalized' }, error });
    }
  }

  // ---- normalizePath --------------------------------------------------------------------------
  try {
    const samples = ['foo\\bar', 'C:\\x\\y.js', 'C:/x/./y.js', native(files.index)];
    for (const s of samples) raw.normalizePath[s] = vite.normalizePath(s);
    // Source (utils.ts L229): path.posix.normalize(isWindows ? slash(id) : id) -> only converts on Windows.
    ctx.claim({
      id: 'vite.normalizePath.backslash',
      claim: "normalizePath('foo\\\\bar') returns 'foo/bar'",
      kind: 'output',
      expected: ctx.isWindows ? 'foo/bar' : 'foo\\bar',
      observed: vite.normalizePath('foo\\bar'),
      notes: 'Docs show foo/bar unconditionally; source only slashes on win32',
    });
    ctx.claim({
      id: 'vite.normalizePath.nativeAbs',
      claim: 'normalizePath(native absolute path) equals toForward(path) (volume kept)',
      kind: 'output',
      expected: fwd(files.index),
      observed: vite.normalizePath(native(files.index)),
    });
  } catch (error) {
    ctx.claimError({
      id: 'vite.normalizePath.backslash',
      claim: 'normalizePath',
      kind: 'output',
      expected: 'foo/bar',
      error,
    });
  }

  return raw;
}
