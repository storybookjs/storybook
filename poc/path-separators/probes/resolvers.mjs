// Probe: module/file resolvers the repo uses — oxc-resolver (`ResolverFactory`), empathic
// (`find`, `walk`, `package`), Node `require.resolve` / `createRequire`, `import.meta.resolve`, and
// tsconfig-paths (`createMatchPath`). For each: separator style of the returned path, for native
// input and for the forward-slash form of the same absolute path (`C:/...`, identical on POSIX).
// Also checks two matching behaviours found in source: empathic's `last` boundary is a plain string
// comparison, and tsconfig-paths splices the specifier's `/` subpath into a native base.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WS = 'code/core';

export function versions(ctx) {
  return {
    node: process.version,
    'oxc-resolver': ctx.packageVersion('oxc-resolver', WS),
    empathic: ctx.packageVersion('empathic', WS),
    'tsconfig-paths': ctx.packageVersion('tsconfig-paths', WS),
  };
}

function writeFixture(workDir) {
  const files = {
    'package.json': JSON.stringify({ name: 'resolvers-fixture', private: true }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['src/*'] } } }),
    'resolvers-marker.txt': 'above the `last` boundary\n',
    'src/a.ts': 'export const a = 1;\n',
    'src/importer.ts': "import { a } from '@/a';\n",
    'src/nested/deep/b.ts': 'export const b = 1;\n',
    'src/nested/deep/c/index.ts': 'export const c = 1;\n',
    'src/resolve-helper.mjs': 'export const resolve = (s) => import.meta.resolve(s);\n',
    'nested/deep/.keep': '',
    'node_modules/fake-pkg/package.json': JSON.stringify({
      name: 'fake-pkg',
      version: '1.0.0',
      main: 'index.js',
    }),
    'node_modules/fake-pkg/index.js': 'module.exports = 1;\n',
  };
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(workDir, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
}

export async function run(ctx) {
  const { isWindows, workDir, separatorStyle, toForward } = ctx;
  const native = isWindows ? 'backslash' : 'forward';
  writeFixture(workDir);
  const fwdDir = toForward(workDir); // identical to workDir on POSIX
  const raw = { workDir, fwdDir };
  /** Absolute fixture path, native or in forward-slash form (the two are identical on POSIX). */
  const at = (forward, ...parts) => (forward ? toForward : (x) => x)(path.join(workDir, ...parts));

  /** Runs one independent step; stores the raw value and records the claim (or a claimError). */
  const step = async (spec, compute, observe = separatorStyle) => {
    try {
      const value = await compute();
      raw[spec.id] = value;
      ctx.claim({ ...spec, observed: observe(value) });
    } catch (error) {
      ctx.claimError({ ...spec, error });
    }
  };

  // ---------------- 1. oxc-resolver ----------------
  try {
    const { ResolverFactory } = ctx.requireFrom(WS)('oxc-resolver');
    // Same options as code/core/.../dependency-graph/resolver-factory.ts.
    const opts = {
      tsconfig: 'auto',
      extensions: ['.tsx', '.ts', '.d.ts', '.jsx', '.js', '.mjs', '.cjs', '.json'],
    };
    const resolver = new ResolverFactory(opts);
    const noSymlinks = new ResolverFactory({ ...opts, symlinks: false });
    /** Returns result.path, or throws with result.error so the step records it. */
    const p = (r) => {
      if (!r.path) throw new Error(`unresolved: ${r.error}`);
      return r.path;
    };
    const srcFile = (dir) => at(dir === fwdDir, 'src', 'importer.ts');
    const cases = [
      ['native', workDir],
      ['forwardInput', fwdDir],
    ];
    const nativeOut = {};
    for (const [form, dir] of cases) {
      const viaForward = form === 'forwardInput';
      const note = viaForward ? ' (directory given as C:/... on Windows)' : '';
      await step(
        {
          id: `oxc.sync.relative.${form}`,
          claim: `ResolverFactory#sync(dir, './src/a.ts') returns a native path${note}`,
          kind: viaForward ? 'input' : 'output',
          expected: native,
          notes:
            'source: load_realpath -> Cache::canonicalize rebuilds the path component by component',
        },
        () => p(resolver.sync(dir, './src/a.ts'))
      );
      await step(
        {
          id: `oxc.sync.bare.${form}`,
          claim: `ResolverFactory#sync(dir, 'fake-pkg') returns a native path${note}`,
          kind: viaForward ? 'input' : 'output',
          expected: native,
        },
        () => p(resolver.sync(dir, 'fake-pkg'))
      );
      await step(
        {
          id: `oxc.resolveFileSync.tsconfigPaths.${form}`,
          claim: `ResolverFactory#resolveFileSync(file, '@/a') (tsconfig paths, tsconfig: 'auto') returns a native path${note}`,
          kind: viaForward ? 'input' : 'output',
          expected: native,
        },
        () => p(resolver.resolveFileSync(srcFile(dir), '@/a'))
      );
      await step(
        {
          id: `oxc.resolveFileAsync.bare.${form}`,
          claim: `ResolverFactory#resolveFileAsync(file, 'fake-pkg') (the API the repo calls) returns a native path${note}`,
          kind: viaForward ? 'input' : 'output',
          expected: native,
        },
        async () => p(await resolver.resolveFileAsync(srcFile(dir), 'fake-pkg'))
      );
      await step(
        {
          id: `oxc.sync.symlinksFalse.relative.${form}`,
          claim: `with symlinks: false, sync(dir, './src/a.ts') still returns a native path${note}`,
          kind: viaForward ? 'input' : 'output',
          expected: native,
          notes: 'source: load_realpath collects components on Windows when the path contains "/"',
        },
        () => p(noSymlinks.sync(dir, './src/a.ts'))
      );
      if (!viaForward) {
        for (const k of [
          'oxc.sync.relative',
          'oxc.sync.bare',
          'oxc.resolveFileSync.tsconfigPaths',
        ]) {
          nativeOut[k] = raw[`${k}.native`];
        }
      }
    }
    await step(
      {
        id: 'oxc.forwardInput.sameStringAsNative',
        claim:
          'for a C:/ input, sync/resolveFileSync return the exact same string as for the native input',
        kind: 'input',
        expected: true,
        notes:
          'compares raw[<id>.native] with raw[<id>.forwardInput]; matters for cache keys / graph ids',
      },
      () =>
        Object.keys(nativeOut).every(
          (k) => nativeOut[k] !== undefined && nativeOut[k] === raw[`${k}.forwardInput`]
        ),
      (v) => v
    );
  } catch (error) {
    ctx.claimError({
      id: 'oxc.load',
      claim: 'oxc-resolver loads',
      kind: 'output',
      expected: true,
      error,
    });
  }

  // ---------------- 2. empathic ----------------
  try {
    const req = ctx.requireFrom(WS);
    const find = req('empathic/find');
    const walk = req('empathic/walk');
    const pkg = req('empathic/package');
    const deep = (dir) => at(dir === fwdDir, 'nested', 'deep');
    for (const [form, dir] of [
      ['native', workDir],
      ['forwardInput', fwdDir],
    ]) {
      const viaForward = form === 'forwardInput';
      const note = viaForward ? ' with a C:/ cwd' : '';
      const kind = viaForward ? 'input' : 'output';
      await step(
        {
          id: `empathic.find.up.${form}`,
          claim: `find.up('tsconfig.json', { cwd }) returns a native path${note}`,
          kind,
          expected: native,
          notes:
            'source: find.mjs builds the result with node:path join(), which normalizes on win32',
        },
        () => find.up('tsconfig.json', { cwd: deep(dir) })
      );
      await step(
        {
          id: `empathic.find.any.${form}`,
          claim: `find.any(['nope.json','tsconfig.json'], { cwd }) returns a native path${note}`,
          kind,
          expected: native,
        },
        () => find.any(['nope.json', 'tsconfig.json'], { cwd: deep(dir) })
      );
      await step(
        {
          id: `empathic.package.up.${form}`,
          claim: `package.up({ cwd }) returns a native path${note}`,
          kind,
          expected: native,
        },
        () => pkg.up({ cwd: deep(dir) })
      );
      await step(
        {
          id: `empathic.walk.up.${form}`,
          claim: `walk.up(cwd) returns parent dirs in the SAME form as the input${note} (dirname() slices, never normalizes)`,
          kind,
          expected: viaForward ? ['forward'] : [native],
          notes: 'observed = distinct separator styles across all returned dirs',
        },
        () => walk.up(deep(dir)),
        (dirs) => [...new Set(dirs.map(separatorStyle))]
      );
    }
    // `last` boundary: walk.up stops when `prev === absolute(last)`, a plain string comparison.
    const outcome = (found) => (found ? 'walked-past-last' : 'stopped-at-last');
    await step(
      {
        id: 'empathic.find.up.last.sameForm',
        claim:
          'find.up stops at `last` when cwd and last use the same form (marker above `last` is not found)',
        kind: 'input',
        expected: 'stopped-at-last',
      },
      () =>
        find.up('resolvers-marker.txt', {
          cwd: path.join(workDir, 'nested', 'deep'),
          last: path.join(workDir, 'nested'),
        }) ?? null,
      outcome
    );
    await step(
      {
        id: 'empathic.find.up.last.mixedForm',
        claim:
          'find.up with a C:/ cwd and a native `last` does NOT recognise `last` and keeps walking to the root',
        kind: 'input',
        expected: isWindows ? 'walked-past-last' : 'stopped-at-last',
        notes: 'on POSIX both forms are the same string, so the boundary holds trivially',
      },
      () =>
        find.up('resolvers-marker.txt', {
          cwd: at(true, 'nested', 'deep'),
          last: path.join(workDir, 'nested'),
        }) ?? null,
      outcome
    );
  } catch (error) {
    ctx.claimError({
      id: 'empathic.load',
      claim: 'empathic loads',
      kind: 'output',
      expected: true,
      error,
    });
  }

  // ---------------- 3. require.resolve / createRequire ----------------
  try {
    const { createRequire } = await import('node:module');
    const nativeReq = createRequire(path.join(workDir, 'src', 'importer.ts'));
    const fwdReq = createRequire(at(true, 'src', 'importer.ts'));
    await step(
      {
        id: 'node.createRequire.resolve.relative.native',
        claim: "createRequire(nativeFile).resolve('./a.ts') is native",
        kind: 'output',
        expected: native,
      },
      () => nativeReq.resolve('./a.ts')
    );
    await step(
      {
        id: 'node.createRequire.resolve.bare.native',
        claim: "createRequire(nativeFile).resolve('fake-pkg') is native",
        kind: 'output',
        expected: native,
      },
      () => nativeReq.resolve('fake-pkg')
    );
    await step(
      {
        id: 'node.createRequire.resolve.relative.forwardInput',
        claim: "createRequire('C:/.../importer.ts').resolve('./a.ts') is accepted and native",
        kind: 'input',
        expected: native,
        notes: 'source: Module._findPath -> path.resolve(curPath, request) then fs.realpathSync',
      },
      () => fwdReq.resolve('./a.ts')
    );
    await step(
      {
        id: 'node.createRequire.resolve.bare.forwardInput',
        claim: "createRequire('C:/...').resolve('fake-pkg') is accepted and native",
        kind: 'input',
        expected: native,
      },
      () => fwdReq.resolve('fake-pkg')
    );
    // `paths` option, from a require() rooted elsewhere (the probe file's own require).
    const outerReq = createRequire(import.meta.url);
    for (const [form, dir] of [
      ['native', workDir],
      ['forwardInput', fwdDir],
    ]) {
      const viaForward = form === 'forwardInput';
      await step(
        {
          id: `node.require.resolve.paths.bare.${form}`,
          claim: `require.resolve('fake-pkg', { paths: [${viaForward ? 'C:/...' : 'native'}] }) is native`,
          kind: viaForward ? 'input' : 'output',
          expected: native,
          notes: 'source: Module._nodeModulePaths(path) calls path.resolve(from) first',
        },
        () => outerReq.resolve('fake-pkg', { paths: [dir] })
      );
      await step(
        {
          id: `node.require.resolve.paths.relative.${form}`,
          claim: `require.resolve('./src/a.ts', { paths: [${viaForward ? 'C:/...' : 'native'}] }) is native`,
          kind: viaForward ? 'input' : 'output',
          expected: native,
        },
        () => outerReq.resolve('./src/a.ts', { paths: [dir] })
      );
    }
  } catch (error) {
    ctx.claimError({
      id: 'node.require.load',
      claim: 'createRequire works',
      kind: 'output',
      expected: true,
      error,
    });
  }

  // ---------------- 4. import.meta.resolve ----------------
  try {
    const helper = await import(
      pathToFileURL(path.join(workDir, 'src', 'resolve-helper.mjs')).href
    );
    const urlShape = (u) =>
      /^file:\/\/\/[A-Za-z]:\//.test(u)
        ? 'drive-url'
        : u.startsWith('file:///')
          ? 'posix-url'
          : `other:${u.slice(0, 12)}`;
    for (const [what, spec] of [
      ['bare', 'fake-pkg'],
      ['relative', './a.ts'],
    ]) {
      await step(
        {
          id: `node.importMetaResolve.${what}.urlShape`,
          claim: `import.meta.resolve('${spec}') returns ${isWindows ? 'file:///C:/...' : 'file:///...'}`,
          kind: 'output',
          expected: isWindows ? 'drive-url' : 'posix-url',
        },
        () => helper.resolve(spec),
        urlShape
      );
      await step(
        {
          id: `node.importMetaResolve.${what}.separators`,
          claim: `import.meta.resolve('${spec}') uses only forward slashes`,
          kind: 'output',
          expected: 'forward',
        },
        () => helper.resolve(spec)
      );
      await step(
        {
          id: `node.importMetaResolve.${what}.fileURLToPath`,
          claim: `fileURLToPath(import.meta.resolve('${spec}')) is native`,
          kind: 'output',
          expected: native,
        },
        () => fileURLToPath(helper.resolve(spec))
      );
    }
  } catch (error) {
    ctx.claimError({
      id: 'node.importMetaResolve.load',
      claim: 'helper module loads',
      kind: 'output',
      expected: true,
      error,
    });
  }

  // ---------------- 5. tsconfig-paths ----------------
  try {
    const { createMatchPath } = ctx.requireFrom(WS)('tsconfig-paths');
    const paths = { '@/*': ['src/*'] };
    const exts = ['.ts', '.tsx', '.js'];
    for (const [form, base] of [
      ['native', workDir],
      ['forwardInput', fwdDir],
    ]) {
      const viaForward = form === 'forwardInput';
      const kind = viaForward ? 'input' : 'output';
      const note = viaForward ? ' (absoluteBaseUrl given as C:/...)' : '';
      // Same call shape as code/presets/react-webpack/src/loaders/react-docgen-loader.ts.
      const matchPath = createMatchPath(base, paths, ['browser', 'module', 'main']);
      const m = (spec) => {
        const r = matchPath(spec, undefined, undefined, exts);
        if (r === undefined) throw new Error(`no match for ${spec}`);
        return r;
      };
      await step(
        {
          id: `tsconfigPaths.match.file.${form}`,
          claim: `matchPath('@/a') returns a native path (extension stripped)${note}`,
          kind,
          expected: native,
          notes: 'source: mapping-entry.js path.resolve(absoluteBaseUrl, "src/*")',
        },
        () => m('@/a')
      );
      await step(
        {
          id: `tsconfigPaths.match.nestedSubpath.${form}`,
          claim: `matchPath('@/nested/deep/b') keeps the specifier's "/" after a native base -> mixed on Windows${note}`,
          kind,
          expected: isWindows ? 'mixed' : 'forward',
          notes:
            'source: try-path.js physicalPathPattern.replace("*", starMatch), no normalization for file/extension hits',
        },
        () => m('@/nested/deep/b')
      );
      await step(
        {
          id: `tsconfigPaths.match.index.${form}`,
          claim: `matchPath('@/nested/deep/c') (index file) returns a native path${note}`,
          kind,
          expected: native,
          notes: 'source: index candidates go through path.join(physicalPath, "/index")',
        },
        () => m('@/nested/deep/c')
      );
      await step(
        {
          id: `tsconfigPaths.match.matchAll.${form}`,
          claim: `matchPath('src/a') via the implicit "*" match-all entry${note}`,
          kind,
          // `${absoluteBaseUrl}/*` is built by string concat, not path.resolve.
          expected: isWindows ? (viaForward ? 'forward' : 'mixed') : 'forward',
          notes: 'source: mapping-entry.js `${absoluteBaseUrl.replace(/\\/$/, "")}/*`',
        },
        () => m('src/a')
      );
    }
  } catch (error) {
    ctx.claimError({
      id: 'tsconfigPaths.load',
      claim: 'tsconfig-paths loads',
      kind: 'output',
      expected: true,
      error,
    });
  }

  return raw;
}
