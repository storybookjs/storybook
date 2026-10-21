// Rolldown (repo root, 1.x): which separators do module ids carry, and which input forms
// (native `\` vs `/` absolute entries, `/`-form alias values, `/`-form plugin ids) does it accept
// on Windows? Also replays generate-types-rolldown's `${path.sep}node_modules${path.sep}dep${path.sep}`
// external matcher against the ids Rolldown passes to `external`.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function versions(ctx) {
  return { rolldown: ctx.packageVersion('rolldown') };
}

const write = (file, content) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
};

/** Collapses the separator styles of a list of ids into one value ('none-collected' if empty). */
function styleOf(ctx, ids) {
  const styles = [...new Set(ids.map((id) => ctx.separatorStyle(id)))].sort();
  if (styles.length === 0) return 'none-collected';
  return styles.length === 1 ? styles[0] : styles.join('+');
}

export async function run(ctx) {
  const { rolldown } = await ctx.importFrom('rolldown');
  const native = ctx.workDir;
  const nativeStyle = ctx.isWindows ? 'backslash' : 'forward';
  const raw = { workDir: native };

  // --- Fixture -------------------------------------------------------------------------------
  const entry = path.join(native, 'entry.js');
  const aFile = path.join(native, 'a.js');
  const bFile = path.join(native, 'sub', 'b.js');
  write(
    entry,
    `import { a } from './a.js';\nimport { b } from './sub/b.js';\nconsole.log(a, b);\n`
  );
  write(
    aFile,
    `globalThis.__count = (globalThis.__count || 0) + 1;\nexport const a = 'A_MARKER';\n`
  );
  write(bFile, `export const b = 'B_MARKER';\n`);
  // Claim 3: alias in `/` form, plus a relative import of the same file (duplicate check).
  write(
    path.join(native, 'entry-alias.js'),
    `import { b } from '@sub/b.js';\nimport { b as b2 } from './sub/b.js';\nconsole.log(b, b2);\n`
  );
  // Claim 4: a plugin-resolved `/`-form id for a.js plus the built-in relative import of a.js.
  write(
    path.join(native, 'entry-plugin.js'),
    `import { a } from 'virtual-a';\nimport { a as a2 } from './a.js';\nconsole.log(a, a2);\n`
  );
  // Claim 5: a dependency inside a local node_modules.
  write(
    path.join(native, 'node_modules', 'fakedep', 'package.json'),
    JSON.stringify({ name: 'fakedep', version: '1.0.0', main: 'index.js' })
  );
  write(
    path.join(native, 'node_modules', 'fakedep', 'index.js'),
    `export const dep = 'DEP_MARKER';\n`
  );
  write(path.join(native, 'entry-dep.js'), `import { dep } from 'fakedep';\nconsole.log(dep);\n`);

  /** Only fixture ids (drop `\0`-prefixed runtime/virtual ids). */
  const inFixture = (id) =>
    typeof id === 'string' && ctx.toForward(id).startsWith(ctx.toForward(native));

  /** Builds with a recording plugin; returns the recorded ids and the generated output. */
  async function build({ input, alias, extraPlugins = [], external }) {
    const rec = {
      resolveIdImporters: [],
      resolveIdCalls: [],
      loadIds: [],
      transformIds: [],
      moduleIds: [],
      chunkModuleIds: [],
      facadeModuleIds: [],
    };
    const bundle = await rolldown({
      input,
      cwd: native,
      logLevel: 'silent',
      ...(alias ? { resolve: { alias } } : {}),
      ...(external ? { external } : {}),
      plugins: [
        ...extraPlugins,
        {
          name: 'record',
          resolveId(source, importer) {
            rec.resolveIdCalls.push({ source, importer });
            if (importer) rec.resolveIdImporters.push(importer);
            return null;
          },
          load(id) {
            rec.loadIds.push(id);
            return null;
          },
          transform(_code, id) {
            rec.transformIds.push(id);
            return null;
          },
          buildEnd() {
            rec.moduleIds.push(...this.getModuleIds());
          },
        },
      ],
    });
    try {
      const { output } = await bundle.generate({ format: 'esm' });
      const chunks = output.filter((o) => o.type === 'chunk');
      for (const chunk of chunks) {
        rec.chunkModuleIds.push(...chunk.moduleIds);
        if (chunk.facadeModuleId) rec.facadeModuleIds.push(chunk.facadeModuleId);
      }
      rec.code = chunks.map((c) => c.code).join('\n/* ---- */\n');
      return rec;
    } finally {
      await bundle.close();
    }
  }

  // --- Claim 1: ids Rolldown resolves itself are native ---------------------------------------
  try {
    const rec = await build({ input: { entry } });
    raw.base = rec;
    const pick = {
      'resolveId.importer': rec.resolveIdImporters.filter(inFixture),
      'load.id': rec.loadIds.filter(inFixture),
      'transform.id': rec.transformIds.filter(inFixture),
      getModuleIds: rec.moduleIds.filter(inFixture),
      'chunk.moduleIds': rec.chunkModuleIds.filter(inFixture),
      'chunk.facadeModuleId': rec.facadeModuleIds.filter(inFixture),
    };
    for (const [key, ids] of Object.entries(pick)) {
      ctx.claim({
        id: `rolldown.output.${key}`,
        claim: `${key} values for modules Rolldown resolved itself are absolute native paths`,
        kind: 'output',
        expected: nativeStyle,
        observed: styleOf(ctx, ids),
        notes: `raw values in raw.base (${key}); input given as native path`,
      });
    }
  } catch (error) {
    ctx.claimError({
      id: 'rolldown.output',
      claim: 'module ids Rolldown resolves itself are native',
      kind: 'output',
      expected: nativeStyle,
      error,
    });
  }

  // --- Claim 2: entry given as native vs `/` absolute path ------------------------------------
  const inputVariants = [
    ['native', entry],
    ['forward', ctx.toForward(entry)],
  ];
  raw.input = {};
  for (const [variant, value] of inputVariants) {
    const id = `rolldown.input.entry.${variant}`;
    const claim = `input given as ${variant} absolute path builds; facade and module ids come out native, with a.js loaded once`;
    if (variant === 'forward' && !ctx.isWindows) {
      // On POSIX the forward form IS the native form (already covered above).
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
      const rec = await build({ input: { entry: value } });
      raw.input[variant] = { input: value, ...rec };
      ctx.claim({
        id,
        claim,
        kind: 'input',
        expected: {
          built: true,
          facadeModuleId: nativeStyle,
          moduleIds: nativeStyle,
          aLoads: 1,
          aMarkerCount: 1,
        },
        observed: {
          built: true,
          facadeModuleId: styleOf(ctx, rec.facadeModuleIds.filter(inFixture)),
          moduleIds: styleOf(ctx, rec.moduleIds.filter(inFixture)),
          aLoads: rec.loadIds.filter((i) => ctx.toForward(i) === ctx.toForward(aFile)).length,
          aMarkerCount: rec.code.split('A_MARKER').length - 1,
        },
        notes: `raw.input.${variant}`,
      });
    } catch (error) {
      raw.input[variant] = { input: value, error: String(error) };
      ctx.claimError({ id, claim, kind: 'input', expected: 'builds', error });
    }
  }

  // --- Claim 3: resolve.alias values in `/` form ----------------------------------------------
  // generate-source-files.ts builds alias values with `pathe` join, i.e. `/` form on Windows.
  const aliasVariants = [
    ['native', path.join(native, 'sub')],
    ['forward', ctx.toForward(path.join(native, 'sub'))],
  ];
  raw.alias = {};
  for (const [variant, value] of aliasVariants) {
    const id = `rolldown.input.alias.${variant}`;
    const claim = `resolve.alias value in ${variant} form resolves; aliased and relative imports of sub/b.js dedupe into one native id`;
    if (variant === 'forward' && !ctx.isWindows) {
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
      const rec = await build({
        input: { entry: path.join(native, 'entry-alias.js') },
        alias: { '@sub': value },
      });
      raw.alias[variant] = { alias: value, ...rec };
      const bIds = rec.moduleIds.filter((i) => ctx.toForward(i) === ctx.toForward(bFile));
      ctx.claim({
        id,
        claim,
        kind: 'input',
        expected: { built: true, bModuleIds: [nativeStyle], bMarkerCount: 1 },
        observed: {
          built: true,
          bModuleIds: bIds.map((i) => ctx.separatorStyle(i)),
          bMarkerCount: rec.code.split('B_MARKER').length - 1,
        },
        notes: `raw.alias.${variant}`,
      });
    } catch (error) {
      raw.alias[variant] = { alias: value, error: String(error) };
      ctx.claimError({ id, claim, kind: 'input', expected: 'builds', error });
    }
  }

  // --- Claim 4: plugin returns a `/`-form absolute id ----------------------------------------
  {
    const id = 'rolldown.input.pluginForwardId';
    const claim =
      'a `/`-form absolute id returned from resolveId is kept verbatim; on Windows it does not dedupe with the native id of the same file (a.js bundled twice)';
    try {
      const forwardA = ctx.toForward(aFile);
      const rec = await build({
        input: { entry: path.join(native, 'entry-plugin.js') },
        extraPlugins: [
          {
            name: 'forward-id',
            resolveId(source) {
              if (source === 'virtual-a') return forwardA;
              return null;
            },
          },
        ],
      });
      raw.pluginForwardId = { returnedId: forwardA, ...rec };
      const aIds = rec.moduleIds.filter((i) => ctx.toForward(i) === forwardA);
      ctx.claim({
        id,
        claim,
        kind: 'input',
        // POSIX: forward IS native, so one module. Windows: prediction = two distinct modules.
        expected: ctx.isWindows
          ? { aModuleIds: ['backslash', 'forward'], forwardIdKeptVerbatim: true, aMarkerCount: 2 }
          : { aModuleIds: ['forward'], forwardIdKeptVerbatim: true, aMarkerCount: 1 },
        observed: {
          aModuleIds: aIds.map((i) => ctx.separatorStyle(i)).sort(),
          forwardIdKeptVerbatim: rec.moduleIds.includes(forwardA),
          aMarkerCount: rec.code.split('A_MARKER').length - 1,
        },
        notes: 'raw.pluginForwardId; aModuleIds = styles of all module ids that point to a.js',
      });
    } catch (error) {
      ctx.claimError({ id, claim, kind: 'input', expected: 'builds', error });
    }
  }

  // --- Claim 5: generate-types-rolldown's external matcher -----------------------------------
  // externalFn there: id === dep || id.startsWith(`${dep}/`) || id.includes(`${sep}node_modules${sep}${dep}${sep}`)
  // Here only the `sep` clause is used, so a match can only come from a resolved (absolute) id.
  {
    const id = 'rolldown.output.external.resolvedId';
    const claim =
      'external() is called with isResolved=true and a native absolute id, so `${path.sep}node_modules${path.sep}dep${path.sep}` matches it (and a `/node_modules/dep/` matcher does not on Windows)';
    try {
      const calls = [];
      const sepNeedle = `${path.sep}node_modules${path.sep}fakedep${path.sep}`;
      const rec = await build({
        input: { entry: path.join(native, 'entry-dep.js') },
        external: (depId, parentId, isResolved) => {
          calls.push({ id: depId, parentId, isResolved });
          return depId.includes(sepNeedle);
        },
      });
      const resolved = calls.filter((c) => c.isResolved && inFixture(c.id));
      raw.external = { sepNeedle, calls, code: rec.code };
      ctx.claim({
        id,
        claim,
        kind: 'output',
        expected: {
          resolvedIdStyle: nativeStyle,
          sepMatcherMatches: true,
          forwardMatcherMatches: !ctx.isWindows,
          depInlined: false,
        },
        observed: {
          resolvedIdStyle: styleOf(
            ctx,
            resolved.map((c) => c.id)
          ),
          sepMatcherMatches: resolved.some((c) => c.id.includes(sepNeedle)),
          forwardMatcherMatches: resolved.some((c) => c.id.includes('/node_modules/fakedep/')),
          depInlined: rec.code.includes('DEP_MARKER'),
        },
        notes: 'raw.external.calls lists every external() call (id, parentId, isResolved)',
      });
    } catch (error) {
      ctx.claimError({ id, claim, kind: 'output', expected: 'builds', error });
    }
  }

  // Trim generated code from raw output to keep the report readable.
  const strip = (rec) =>
    rec && typeof rec.code === 'string' && (rec.code = rec.code.slice(0, 2000));
  [
    raw.base,
    raw.input.native,
    raw.input.forward,
    raw.alias.native,
    raw.alias.forward,
    raw.pluginForwardId,
  ].forEach(strip);
  return raw;
}
