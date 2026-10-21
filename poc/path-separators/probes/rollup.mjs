// Rollup (repo root, 4.x) with NO resolver plugins, so relative imports go through Rollup's
// default resolution (node:path `resolve(dirname(importer), source)`).
//   1. Output: ids from default resolution are native (`\` on Windows) everywhere they surface.
//   2. Input: entry `input` as native vs `/` path; which id format results for entry and imports.
//   3. Input: a plugin returning a `/` absolute id is kept as-is; importing the same file again
//      via default resolution yields a second (native) id, i.e. a duplicate module on Windows.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function versions(ctx) {
  return { rollup: ctx.packageVersion('rollup') };
}

const A_MARKER = 'A_MODULE_BODY_MARKER';

function writeFixture(dir) {
  mkdirSync(path.join(dir, 'sub'), { recursive: true });
  writeFileSync(
    path.join(dir, 'entry.js'),
    `import { a } from './a.js';\nimport { b } from './sub/b.js';\nconsole.log(a, b);\n`
  );
  writeFileSync(path.join(dir, 'a.js'), `export const a = '${A_MARKER}';\n`);
  // b.js imports a.js again, always through default resolution (used by claim 3).
  writeFileSync(
    path.join(dir, 'sub', 'b.js'),
    `import { a } from '../a.js';\nexport const b = 'b:' + a;\n`
  );
}

/** Records every id Rollup hands to plugin hooks. `redirect` optionally overrides resolveId. */
function recorder(rec, redirect) {
  return {
    name: 'record',
    resolveId(source, importer, options) {
      rec.resolveId.push({ source, importer: importer ?? null, isEntry: options.isEntry });
      return redirect ? redirect(source, importer) : null;
    },
    load(id) {
      rec.load.push(id);
      return null;
    },
    transform(_code, id) {
      rec.transform.push(id);
      return null;
    },
    buildEnd() {
      rec.getModuleIds = [...this.getModuleIds()];
    },
  };
}

async function build(rollup, input, redirect) {
  const rec = { resolveId: [], load: [], transform: [], getModuleIds: [] };
  const bundle = await rollup.rollup({
    input,
    treeshake: false,
    logLevel: 'silent',
    plugins: [recorder(rec, redirect)],
  });
  const { output } = await bundle.generate({ format: 'es' });
  await bundle.close();
  const chunk = output.find((o) => o.type === 'chunk');
  rec.chunk = {
    facadeModuleId: chunk.facadeModuleId,
    moduleIds: chunk.moduleIds,
    modulesKeys: Object.keys(chunk.modules),
    aMarkerCount: chunk.code.split(A_MARKER).length - 1,
  };
  return rec;
}

/** Unique, sorted separator styles of a list of ids (absolute ids only). */
const styles = (ctx, ids) => [...new Set(ids.map((id) => ctx.separatorStyle(id)))].sort();
const endsWithFile = (id, rel) => id.replace(/\\/g, '/').endsWith(rel);

export async function run(ctx) {
  const rollup = await ctx.importFrom('rollup');
  const native = ctx.isWindows ? 'backslash' : 'forward';
  const raw = { workDir: ctx.workDir };

  const dir = ctx.workDir;
  writeFixture(dir);
  const entryNative = path.join(dir, 'entry.js');
  const aNative = path.join(dir, 'a.js');

  // ---- 1. Output: ids from default resolution -----------------------------------------------
  try {
    const rec = await build(rollup, entryNative);
    raw.defaultResolution = rec;
    const importers = rec.resolveId.filter((r) => r.importer).map((r) => r.importer);
    const checks = [
      ['resolveId.importer', 'resolveId `importer` (id of the importing module)', importers],
      ['load.id', 'load hook `id`', rec.load],
      ['transform.id', 'transform hook `id`', rec.transform],
      ['getModuleIds', 'this.getModuleIds() entries', rec.getModuleIds],
      ['chunk.moduleIds', 'chunk.moduleIds entries', rec.chunk.moduleIds],
      ['chunk.modules.keys', 'Object.keys(chunk.modules)', rec.chunk.modulesKeys],
      ['chunk.facadeModuleId', 'chunk.facadeModuleId', [rec.chunk.facadeModuleId]],
    ];
    for (const [suffix, what, ids] of checks) {
      ctx.claim({
        id: `rollup.default.${suffix}`,
        claim: `${what} is native-separated (default resolution, native input)`,
        kind: 'output',
        expected: [native],
        observed: styles(ctx, ids),
        notes: `raw.defaultResolution; ${ids.length} id(s)`,
      });
    }
    ctx.claim({
      id: 'rollup.default.moduleCount',
      claim: 'Graph has exactly 3 modules (entry, a, sub/b); a.js imported twice is one module',
      kind: 'output',
      expected: 3,
      observed: rec.getModuleIds.length,
    });
  } catch (error) {
    ctx.claimError({
      id: 'rollup.default',
      claim: 'default-resolution build',
      kind: 'output',
      expected: [native],
      error,
    });
  }

  // ---- 2. Input: entry as native vs forward-slash path ---------------------------------------
  // Default resolution of the entry runs path.resolve(input), which on Windows rewrites `/` to `\`,
  // so the prediction is native ids for both input forms.
  const variants = { native: entryNative, forward: ctx.toForward(entryNative) };
  raw.inputVariants = {};
  for (const [name, input] of Object.entries(variants)) {
    try {
      const rec = await build(rollup, input);
      const entryCall = rec.resolveId.find((r) => r.isEntry);
      const aId = rec.getModuleIds.find((id) => endsWithFile(id, '/a.js'));
      raw.inputVariants[name] = { input, entrySourceSeenByPlugin: entryCall?.source, rec };
      ctx.claim({
        id: `rollup.input.${name}.accepted`,
        claim: `entry input given as ${name} path builds`,
        kind: 'input',
        expected: true,
        observed: true,
        notes: `input=${input}`,
      });
      ctx.claim({
        id: `rollup.input.${name}.resolveIdSource`,
        claim: `resolveId sees the entry source exactly as passed in \`input\` (${name})`,
        kind: 'input',
        expected: true,
        observed: entryCall?.source === input,
        notes: `seen=${entryCall?.source}`,
      });
      ctx.claim({
        id: `rollup.input.${name}.entryId`,
        claim: `facadeModuleId (entry id) separator style for ${name} input`,
        kind: 'output',
        expected: native,
        observed: ctx.separatorStyle(rec.chunk.facadeModuleId),
        notes: `facadeModuleId=${rec.chunk.facadeModuleId}`,
      });
      ctx.claim({
        id: `rollup.input.${name}.importId`,
        claim: `id of relative import ./a.js separator style for ${name} input`,
        kind: 'output',
        expected: native,
        observed: ctx.separatorStyle(aId),
        notes: `aId=${aId}`,
      });
    } catch (error) {
      ctx.claimError({
        id: `rollup.input.${name}.accepted`,
        claim: `entry input given as ${name} path builds`,
        kind: 'input',
        expected: true,
        error,
      });
    }
  }
  if (!ctx.isWindows) {
    ctx.claim({
      id: 'rollup.input.backslash.accepted',
      claim: 'entry input given as backslash path builds',
      kind: 'input',
      expected: 'skipped-on-posix',
      observed: 'skipped-on-posix',
    });
  }

  // ---- 3. Plugin returns a `/` absolute id for ./a.js (from entry only) ----------------------
  // sub/b.js still imports ../a.js through default resolution (native id).
  try {
    const aForward = ctx.toForward(aNative);
    const rec = await build(rollup, entryNative, (source, importer) =>
      source === './a.js' && importer && endsWithFile(importer, '/entry.js') ? aForward : null
    );
    raw.pluginForwardId = { returnedId: aForward, rec };
    const aLoadIds = rec.load.filter((id) => endsWithFile(id, '/a.js'));
    const aTransformIds = rec.transform.filter((id) => endsWithFile(id, '/a.js'));
    const aModuleIds = rec.getModuleIds.filter((id) => endsWithFile(id, '/a.js'));
    ctx.claim({
      id: 'rollup.pluginId.keptAsIs',
      claim: 'A `/` id returned from resolveId reaches load unchanged',
      kind: 'input',
      expected: true,
      observed: aLoadIds.includes(aForward),
      notes: `load ids for a.js: ${JSON.stringify(aLoadIds)}`,
    });
    ctx.claim({
      id: 'rollup.pluginId.load.styles',
      claim: 'Separator styles of load ids for a.js (plugin `/` id + default-resolved id)',
      kind: 'output',
      expected: ctx.isWindows ? ['backslash', 'forward'] : ['forward'],
      observed: styles(ctx, aLoadIds),
    });
    ctx.claim({
      id: 'rollup.pluginId.transform.styles',
      claim: 'Separator styles of transform ids for a.js',
      kind: 'output',
      expected: ctx.isWindows ? ['backslash', 'forward'] : ['forward'],
      observed: styles(ctx, aTransformIds),
    });
    ctx.claim({
      id: 'rollup.pluginId.duplicateModule',
      claim: 'a.js becomes two modules (one `/` id, one native id) on Windows; one module on POSIX',
      kind: 'output',
      expected: ctx.isWindows ? 2 : 1,
      observed: aModuleIds.length,
      notes: `module ids for a.js: ${JSON.stringify(aModuleIds)}`,
    });
    ctx.claim({
      id: 'rollup.pluginId.duplicateInOutput',
      claim: 'a.js body appears twice in the bundle on Windows (duplicate module), once on POSIX',
      kind: 'output',
      expected: ctx.isWindows ? 2 : 1,
      observed: rec.chunk.aMarkerCount,
    });
  } catch (error) {
    ctx.claimError({
      id: 'rollup.pluginId.keptAsIs',
      claim: 'A `/` id returned from resolveId reaches load unchanged',
      kind: 'input',
      expected: true,
      error,
    });
  }

  return raw;
}
