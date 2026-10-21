// Probe: path separators in glob libraries (glob 10.x, tinyglobby, fdir, node:fs globSync).
// Checks the separator style of returned paths (relative and absolute) and which pattern forms
// (node:path join, pathe join, manual `/`, literal `\`) actually match, with `cwd` in both forms.
import fs from 'node:fs';
import path from 'node:path';

const FILES = ['src/a.ts', 'src/sub/b.ts', 'src/sub/c.stories.ts'];

/** Combined separator style of a list of paths; 'empty' when nothing matched. */
function listStyle(ctx, list) {
  if (!Array.isArray(list)) return 'not-an-array';
  if (list.length === 0) return 'empty';
  const styles = [...new Set(list.map((p) => ctx.separatorStyle(String(p))))];
  return styles.length === 1 ? styles[0] : `mixed-list:${styles.sort().join(',')}`;
}

export function versions(ctx) {
  return {
    glob: ctx.packageVersion('glob'),
    'glob (code/core)': ctx.packageVersion('glob', 'code/core'),
    tinyglobby: ctx.packageVersion('tinyglobby'),
    'tinyglobby (code/core)': ctx.packageVersion('tinyglobby', 'code/core'),
    fdir: ctx.packageVersion('fdir'),
    // pathe's `exports` hides package.json, so read it from disk.
    pathe: JSON.parse(
      fs.readFileSync(path.join(ctx.REPO_ROOT, 'node_modules', 'pathe', 'package.json'), 'utf8')
    ).version,
    node: process.version,
  };
}

export async function run(ctx) {
  const raw = { workDir: ctx.workDir, glob: {}, tinyglobby: {}, fdir: {}, nodeFs: {} };
  for (const f of FILES) {
    const abs = path.join(ctx.workDir, ...f.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, 'export {};\n');
  }

  const native = ctx.isWindows ? 'backslash' : 'forward';
  const cwdForms = { native: ctx.workDir, forward: ctx.toForward(ctx.workDir) };
  const pathe = await ctx.importFrom('pathe');

  // Pattern variants. `nodeJoin` is native (backslashes on Windows); the others use `/`.
  const absPatterns = {
    nodeJoin: path.join(ctx.workDir, 'src', '**', '*.ts'),
    patheJoin: pathe.join(ctx.workDir, 'src', '**', '*.ts'),
    manual: `${ctx.toForward(ctx.workDir)}/src/**/*.ts`,
  };
  const relPatterns = {
    nodeJoin: path.join('src', '**', '*.ts'),
    patheJoin: pathe.join('src', '**', '*.ts'),
    manual: 'src/**/*.ts',
  };
  // A literal-backslash pattern is a valid *pattern* on every OS (it is not a path), so it is
  // tested everywhere: by default `\` escapes the next char, so it should match nothing.
  const literalBackslash = 'src\\**\\*.ts';
  raw.patterns = { absPatterns, relPatterns, literalBackslash };

  // Helper: run one step, record claim or error.
  const step = (meta, fn) => {
    try {
      const observed = fn();
      ctx.claim({ ...meta, observed });
    } catch (error) {
      ctx.claimError({ ...meta, error });
    }
  };
  const stepAsync = async (meta, fn) => {
    try {
      const observed = await fn();
      ctx.claim({ ...meta, observed });
    } catch (error) {
      ctx.claimError({ ...meta, error });
    }
  };

  // ---------------------------------------------------------------------------------------------
  // 1. glob: output separators
  // ---------------------------------------------------------------------------------------------
  const globMod = await ctx.importFrom('glob', 'code/core');
  const { glob, globSync, Glob } = globMod;
  const G = raw.glob;

  const globOutputs = [
    ['relative.default', {}, native],
    ['absolute.default', { absolute: true }, native],
    ['relative.posix', { posix: true }, 'forward'],
    ['absolute.posix', { absolute: true, posix: true }, 'forward'],
  ];
  for (const [name, opts, expected] of globOutputs) {
    step(
      {
        id: `glob.globSync.${name}`,
        claim: `glob globSync(${JSON.stringify(opts)}) returns ${expected} separators on this platform`,
        kind: 'output',
        expected,
        notes: `raw.glob['globSync.${name}']`,
      },
      () => {
        const out = globSync('src/**/*.ts', { cwd: ctx.workDir, ...opts }).sort();
        G[`globSync.${name}`] = out;
        return listStyle(ctx, out);
      }
    );
    await stepAsync(
      {
        id: `glob.glob.${name}`,
        claim: `glob async glob(${JSON.stringify(opts)}) returns ${expected} separators on this platform`,
        kind: 'output',
        expected,
        notes: `raw.glob['glob.${name}']`,
      },
      async () => {
        const out = (await glob('src/**/*.ts', { cwd: ctx.workDir, ...opts })).sort();
        G[`glob.${name}`] = out;
        return listStyle(ctx, out);
      }
    );
  }
  step(
    {
      id: 'glob.globSync.absolute.posix.uncPrefix',
      claim:
        'glob absolute+posix results on Windows use the `//?/C:/...` UNC form (README `posix` option)',
      kind: 'output',
      expected: ctx.isWindows,
      notes: 'observed = result starts with "//?/"; raw.glob["globSync.absolute.posix"]',
    },
    () => {
      const out = globSync('src/**/*.ts', { cwd: ctx.workDir, absolute: true, posix: true });
      return out.length > 0 && out.every((p) => p.startsWith('//?/'));
    }
  );

  // ---------------------------------------------------------------------------------------------
  // 2. glob: pattern inputs
  // ---------------------------------------------------------------------------------------------
  step(
    {
      id: 'glob.windowsPathsNoEscape.default',
      claim: 'glob windowsPathsNoEscape defaults to false (also on Windows)',
      kind: 'input',
      expected: false,
      notes: 'read from new Glob(pattern, {}).windowsPathsNoEscape',
    },
    () => new Glob('src/**/*.ts', { cwd: ctx.workDir }).windowsPathsNoEscape
  );

  // Absolute patterns. On Windows the node:path join pattern contains `\` and should match nothing
  // unless windowsPathsNoEscape is set.
  for (const [pname, pattern] of Object.entries(absPatterns)) {
    for (const noEscape of [false, true]) {
      const hasBackslash = pattern.includes('\\');
      const expected = hasBackslash && !noEscape ? 0 : 3;
      const key = `abs.${pname}${noEscape ? '.windowsPathsNoEscape' : ''}`;
      step(
        {
          id: `glob.pattern.${key}`,
          claim: `glob absolute pattern built with ${pname}${noEscape ? ' + windowsPathsNoEscape' : ''} matches all 3 files unless it contains \\ (escape)`,
          kind: 'input',
          expected,
          notes: `observed = match count; pattern = ${JSON.stringify(pattern)}; raw.glob['pattern.${key}']`,
        },
        () => {
          const out = globSync(pattern, { windowsPathsNoEscape: noEscape }).sort();
          G[`pattern.${key}`] = { pattern, out, style: listStyle(ctx, out) };
          return out.length;
        }
      );
    }
  }
  // Absolute forward-slash pattern: results are absolute and (default) native.
  step(
    {
      id: 'glob.pattern.abs.manual.outputStyle',
      claim:
        'glob results for an absolute `/` pattern are absolute native paths (pattern form does not leak into output)',
      kind: 'output',
      expected: native,
      notes: 'raw.glob["pattern.abs.manual"].out',
    },
    () => listStyle(ctx, globSync(absPatterns.manual))
  );

  // Relative patterns with cwd in both forms.
  for (const [cname, cwd] of Object.entries(cwdForms)) {
    for (const [pname, pattern] of Object.entries(relPatterns)) {
      const expected = pattern.includes('\\') ? 0 : 3;
      const key = `rel.${pname}.cwd-${cname}`;
      step(
        {
          id: `glob.pattern.${key}`,
          claim: `glob relative pattern built with ${pname}, cwd in ${cname} form, matches all 3 files unless it contains \\`,
          kind: 'input',
          expected,
          notes: `observed = match count; pattern = ${JSON.stringify(pattern)}, cwd = ${JSON.stringify(cwd)}`,
        },
        () => {
          const out = globSync(pattern, { cwd }).sort();
          G[`pattern.${key}`] = { pattern, cwd, out, style: listStyle(ctx, out) };
          return out.length;
        }
      );
    }
    step(
      {
        id: `glob.cwd-${cname}.outputStyle`,
        claim: `glob output style does not depend on the cwd form (${cname})`,
        kind: 'output',
        expected: native,
      },
      () => listStyle(ctx, globSync('src/**/*.ts', { cwd, absolute: true }))
    );
  }
  for (const noEscape of [false, true]) {
    const key = `literalBackslash${noEscape ? '.windowsPathsNoEscape' : ''}`;
    step(
      {
        id: `glob.pattern.${key}`,
        claim: `glob pattern 'src\\**\\*.ts'${noEscape ? ' with windowsPathsNoEscape' : ''} ${noEscape ? 'matches 3 (\\ rewritten to /)' : 'matches nothing (\\ is an escape)'}`,
        kind: 'input',
        expected: noEscape ? 3 : 0,
        notes: 'tested on every OS: it is a pattern, not a path',
      },
      () => {
        const out = globSync(literalBackslash, {
          cwd: ctx.workDir,
          windowsPathsNoEscape: noEscape,
        });
        G[`pattern.${key}`] = out;
        return out.length;
      }
    );
  }

  // ---------------------------------------------------------------------------------------------
  // 3. tinyglobby
  // ---------------------------------------------------------------------------------------------
  const tg = await ctx.importFrom('tinyglobby', 'code/core');
  const T = raw.tinyglobby;
  for (const [cname, cwd] of Object.entries(cwdForms)) {
    for (const absolute of [false, true]) {
      const key = `${absolute ? 'absolute' : 'relative'}.cwd-${cname}`;
      step(
        {
          id: `tinyglobby.globSync.${key}`,
          claim: `tinyglobby globSync returns / on every platform (${key})`,
          kind: 'output',
          expected: 'forward',
          notes: `raw.tinyglobby['globSync.${key}']`,
        },
        () => {
          const out = tg.globSync('src/**/*.ts', { cwd, absolute }).sort();
          T[`globSync.${key}`] = out;
          return listStyle(ctx, out);
        }
      );
    }
  }
  await stepAsync(
    {
      id: 'tinyglobby.glob.absolute',
      claim: 'tinyglobby async glob with absolute:true returns /',
      kind: 'output',
      expected: 'forward',
    },
    async () => {
      const out = (await tg.glob('src/**/*.ts', { cwd: ctx.workDir, absolute: true })).sort();
      T['glob.absolute'] = out;
      return listStyle(ctx, out);
    }
  );
  // Patterns
  const tgPatterns = {
    ...Object.fromEntries(Object.entries(absPatterns).map(([k, v]) => [`abs.${k}`, v])),
    ...Object.fromEntries(Object.entries(relPatterns).map(([k, v]) => [`rel.${k}`, v])),
    literalBackslash,
  };
  for (const [pname, pattern] of Object.entries(tgPatterns)) {
    const expected = pattern.includes('\\') ? 0 : 3;
    step(
      {
        id: `tinyglobby.pattern.${pname}`,
        claim: `tinyglobby pattern ${pname} matches all 3 files unless it contains \\ (escape, never a separator)`,
        kind: 'input',
        expected,
        notes: `observed = match count; pattern = ${JSON.stringify(pattern)}`,
      },
      () => {
        const out = tg.globSync(pattern, { cwd: ctx.workDir }).sort();
        T[`pattern.${pname}`] = { pattern, out };
        return out.length;
      }
    );
  }
  step(
    {
      id: 'tinyglobby.convertPathToPattern',
      claim:
        'convertPathToPattern(native workDir) + "/src/**/*.ts" matches all 3 on every platform',
      kind: 'input',
      expected: 3,
      notes: 'raw.tinyglobby.convertPathToPattern',
    },
    () => {
      const pattern = `${tg.convertPathToPattern(ctx.workDir)}/src/**/*.ts`;
      const out = tg.globSync(pattern, { cwd: ctx.workDir });
      T.convertPathToPattern = { pattern, out };
      return out.length;
    }
  );

  // ---------------------------------------------------------------------------------------------
  // 4. fdir
  // ---------------------------------------------------------------------------------------------
  const { fdir } = await ctx.importFrom('fdir', 'code/core');
  const F = raw.fdir;
  const fdirCases = [
    ['default', (b) => b, 'none', 'filenames only by default'],
    ['withFullPaths', (b) => b.withFullPaths(), native, 'path.sep by default'],
    ['withBasePath', (b) => b.withBasePath(), native, 'path.sep by default'],
    ['withRelativePaths', (b) => b.withRelativePaths(), native, 'path.sep by default'],
    [
      'withFullPaths.withPathSeparator(/)',
      (b) => b.withFullPaths().withPathSeparator('/'),
      'forward',
      '',
    ],
    [
      'withRelativePaths.withPathSeparator(/)',
      (b) => b.withRelativePaths().withPathSeparator('/'),
      'forward',
      '',
    ],
  ];
  for (const [cname, root] of Object.entries(cwdForms)) {
    for (const [name, build, expected, note] of fdirCases) {
      const key = `${name}.root-${cname}`;
      step(
        {
          id: `fdir.${key}`,
          claim: `fdir ${name} output separator (${note || 'explicit separator'}), root in ${cname} form`,
          kind: 'output',
          expected,
          notes: `raw.fdir['${key}']; root form does not change output (root is passed through convertSlashes)`,
        },
        () => {
          const out = build(new fdir()).crawl(root).sync().sort();
          F[key] = out;
          return listStyle(ctx, out);
        }
      );
    }
  }

  // ---------------------------------------------------------------------------------------------
  // 5. node:fs globSync
  // ---------------------------------------------------------------------------------------------
  const N = raw.nodeFs;
  N.available = typeof fs.globSync === 'function';
  if (!N.available) {
    ctx.claim({
      id: 'node.fs.globSync.available',
      claim: 'node:fs globSync exists in this Node',
      kind: 'output',
      expected: true,
      observed: false,
      notes: `Node ${process.version}`,
    });
  } else {
    for (const [cname, cwd] of Object.entries(cwdForms)) {
      step(
        {
          id: `node.fs.globSync.relative.cwd-${cname}`,
          claim: 'node:fs globSync returns native separators (results built with path.join)',
          kind: 'output',
          expected: native,
          notes: `raw.nodeFs['relative.cwd-${cname}']`,
        },
        () => {
          const out = fs.globSync('src/**/*.ts', { cwd }).sort();
          N[`relative.cwd-${cname}`] = out;
          return listStyle(ctx, out);
        }
      );
    }
    for (const [pname, pattern] of Object.entries(absPatterns)) {
      step(
        {
          id: `node.fs.globSync.pattern.abs.${pname}`,
          claim: `node:fs globSync absolute pattern (${pname}) matches all 3 (Node sets windowsPathsNoEscape: true)`,
          kind: 'input',
          expected: 3,
          notes: `observed = match count; pattern = ${JSON.stringify(pattern)}`,
        },
        () => {
          const out = fs.globSync(pattern).sort();
          N[`pattern.abs.${pname}`] = { pattern, out, style: listStyle(ctx, out) };
          return out.length;
        }
      );
    }
    step(
      {
        id: 'node.fs.globSync.pattern.abs.outputStyle',
        claim: 'node:fs globSync with an absolute `/` pattern returns absolute native paths',
        kind: 'output',
        expected: native,
      },
      () => listStyle(ctx, fs.globSync(absPatterns.manual))
    );
    for (const [pname, pattern] of Object.entries({ ...relPatterns, literalBackslash })) {
      // Node passes windowsPathsNoEscape: true to its vendored minimatch, which rewrites every `\`
      // to `/` regardless of platform (deps/minimatch/index.js), so `\` is a separator everywhere.
      step(
        {
          id: `node.fs.globSync.pattern.rel.${pname}`,
          claim: `node:fs globSync relative pattern (${pname}) matches all 3: \\ is always a separator, never an escape`,
          kind: 'input',
          expected: 3,
          notes: `observed = match count; pattern = ${JSON.stringify(pattern)}`,
        },
        () => {
          const out = fs.globSync(pattern, { cwd: ctx.workDir }).sort();
          N[`pattern.rel.${pname}`] = { pattern, out };
          return out.length;
        }
      );
    }
  }

  return raw;
}
