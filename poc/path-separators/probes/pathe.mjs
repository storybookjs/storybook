// Probe: pathe separator behaviour, against both versions the repo installs.
//   pathe1 = pathe 1.1.2 resolved from code/core, pathe2 = pathe 2.0.3 resolved from the repo root.
// Checks: forward-slash outputs and drive-letter uppercasing, backslash inputs accepted on every
// platform (also on POSIX, where `\` is a legal file-name character), sep/delimiter, the
// basename/parse/extname edge cases, leading `//`, case- and drive-sensitivity of relative(),
// win32/posix exports and resolve() against process.cwd(). pathe is pure string manipulation, so
// most inputs (even `C:\...`) are exercised on Linux too; raw.comparisons holds the matching
// node:path results (platform, plus posix and win32 for reference).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKSPACES = { pathe1: 'code/core', pathe2: '.' };

/** `pathe/package.json` is not in pathe 2's `exports`, so read it next to the resolved entry. */
function patheInfo(ctx, workspace) {
  const entry = ctx.requireFrom(workspace).resolve('pathe');
  const pkgFile = path.join(path.dirname(entry), '..', 'package.json');
  return { entry, version: JSON.parse(readFileSync(pkgFile, 'utf8')).version };
}

export function versions(ctx) {
  return Object.fromEntries(
    Object.entries(WORKSPACES).map(([tag, ws]) => [`${tag} (${ws})`, patheInfo(ctx, ws).version])
  );
}

const upperDrive = (p) => p.replace(/^[a-z]:/, (d) => d.toUpperCase());

export async function run(ctx) {
  const libs = {};
  for (const [tag, ws] of Object.entries(WORKSPACES)) {
    const { entry, version } = patheInfo(ctx, ws);
    // Named exports through ctx.importFrom (CJS build); the ESM build for the default export,
    // because importing CJS from ESM makes `default` the whole exports object.
    const mod = await ctx.importFrom('pathe', ws);
    const esm = await import(pathToFileURL(entry.replace(/index\.cjs$/, 'index.mjs')).href);
    libs[tag] = {
      mod,
      esm,
      version,
      major: Number(version.split('.')[0]),
      entry,
    };
  }

  const raw = {
    platform: process.platform,
    cwd: process.cwd(),
    workDir: ctx.workDir,
    versions: Object.fromEntries(Object.entries(libs).map(([t, l]) => [t, l.version])),
    comparisons: [],
  };

  /** Calls `fn` on each pathe version and on node:path (platform, posix, win32) for the raw table. */
  const compare = (label, fn) => {
    const row = { input: label };
    const safe = (impl) => {
      try {
        return fn(impl);
      } catch (e) {
        return `THREW: ${e?.message ?? e}`;
      }
    };
    for (const [tag, lib] of Object.entries(libs)) row[tag] = safe(lib.mod);
    row.node = safe(path);
    row.nodePosix = safe(path.posix);
    row.nodeWin32 = safe(path.win32);
    raw.comparisons.push(row);
    return row;
  };

  /** One claim per pathe version; `spec(lib)` returns { expected, observed, notes?, check? }. */
  const each = (suffix, claim, kind, spec) => {
    for (const [tag, lib] of Object.entries(libs)) {
      const id = `${tag}.${suffix}`;
      try {
        const { expected, observed, notes, check } = spec(lib.mod, lib, tag);
        ctx.claim({ id, claim, kind, expected, observed, notes, check });
      } catch (error) {
        ctx.claimError({ id, claim, kind, expected: '(see claim)', error });
      }
    }
  };

  const native = ctx.workDir;
  const nativeFile = path.join(native, 'sub', 'file.js');
  const expectedDir = upperDrive(ctx.toForward(native));

  // ---- 1. Outputs use '/', drive letter uppercased --------------------------------------------
  compare(`resolve(workDir)`, (p) => p.resolve(native));
  compare(`join(workDir, 'a', 'b')`, (p) => p.join(native, 'a', 'b'));
  compare(`dirname(workDir/sub/file.js)`, (p) => p.dirname(nativeFile));
  compare(`relative(workDir, workDir/sub/file.js)`, (p) => p.relative(native, nativeFile));
  compare(`normalize(workDir/a/../b)`, (p) => p.normalize([native, 'a', '..', 'b'].join(path.sep)));

  each('output.resolve.native', 'resolve(<native abs path>) returns a "/" path', 'output', (p) => ({
    expected: expectedDir,
    observed: p.resolve(native),
  }));
  each(
    'output.join.native',
    'join(<native abs path>, "a", "b") returns a "/" path',
    'output',
    (p) => ({
      expected: `${expectedDir}/a/b`,
      observed: p.join(native, 'a', 'b'),
    })
  );
  each(
    'output.dirname.native',
    'dirname(<native file path>) returns a "/" path',
    'output',
    (p) => ({
      expected: `${expectedDir}/sub`,
      observed: p.dirname(nativeFile),
    })
  );
  each(
    'output.relative.native',
    'relative(<native>, <native>) returns a "/" path',
    'output',
    (p) => ({
      expected: 'sub/file.js',
      observed: p.relative(native, nativeFile),
    })
  );
  each(
    'output.normalize.native',
    'normalize(<native path with ..>) returns a "/" path',
    'output',
    (p) => ({
      expected: `${expectedDir}/b`,
      observed: p.normalize([native, 'a', '..', 'b'].join(path.sep)),
    })
  );

  const driveCases = {
    resolve: (p) => p.resolve('c:\\x'),
    normalize: (p) => p.normalize('c:\\x\\..\\y'),
    join: (p) => p.join('c:\\x', 'y'),
    dirname: (p) => p.dirname('c:\\x\\y'),
  };
  const driveExpected = {
    resolve: 'C:/x',
    normalize: 'C:/y',
    join: 'C:/x/y',
    dirname: 'C:/x',
  };
  for (const [fn, call] of Object.entries(driveCases)) {
    compare(`${fn} with lowercase drive`, call);
    each(
      `output.driveUpper.${fn}`,
      `${fn}() uppercases a lowercase drive letter and returns "/"`,
      'output',
      (p) => ({
        expected: driveExpected[fn],
        observed: call(p),
        notes:
          'pathe treats `X:/` as absolute on every platform, so the result is the same on POSIX',
      })
    );
  }

  // ---- 2. Backslash inputs accepted on every platform ----------------------------------------
  compare(`join('/a', 'b\\\\*.js')`, (p) => p.join('/a', 'b\\*.js'));
  compare(`basename('a\\\\b.js')`, (p) => p.basename('a\\b.js'));
  compare(`resolve(toBackslash('/a/b'))`, (p) => p.resolve('\\a\\b'));

  each(
    'input.backslash.join',
    "join('/a', 'b\\\\*.js') converts the backslash on every platform",
    'input',
    (p) => ({
      expected: '/a/b/*.js',
      observed: p.join('/a', 'b\\*.js'),
      notes:
        'Not skipped on POSIX: the claim is precisely that pathe rewrites `\\` even where it is a legal file-name character',
    })
  );
  each(
    'input.backslash.basename',
    "basename('a\\\\b.js') splits on the backslash on every platform",
    'input',
    (p) => ({
      expected: 'b.js',
      observed: p.basename('a\\b.js'),
      notes: 'node:path posix returns "a\\\\b.js"',
    })
  );
  each(
    'input.nativeVsForward.resolve',
    'resolve() gives the same result for the native and "/" forms',
    'input',
    (p) => ({
      expected: { native: expectedDir, forward: expectedDir },
      observed: {
        native: p.resolve(native),
        forward: p.resolve(ctx.toForward(native)),
      },
    })
  );
  each(
    'input.backslashForm.resolve',
    'resolve() accepts the all-backslash form of the work dir',
    'input',
    (p) => ({
      expected: ctx.isWindows ? expectedDir : 'skipped-on-posix',
      observed: ctx.isWindows ? p.resolve(ctx.toBackslash(native)) : 'skipped-on-posix',
    })
  );

  // A real POSIX file whose name contains a backslash: pathe turns it into a sub-directory.
  each(
    'input.backslash.posixFileName',
    'A POSIX file named "b\\\\c.txt" cannot be reached through pathe.join (backslash becomes "/")',
    'input',
    (p) => {
      if (ctx.isWindows)
        return {
          expected: 'skipped-on-windows',
          observed: 'skipped-on-windows',
        };
      const realFile = path.join(native, 'b\\c.txt');
      writeFileSync(realFile, 'x');
      const viaPathe = p.join(native, 'b\\c.txt');
      raw.posixBackslashFile = { realFile, viaPathe };
      return {
        expected: { nodeExists: true, patheExists: false },
        observed: {
          nodeExists: existsSync(realFile),
          patheExists: existsSync(viaPathe),
        },
      };
    }
  );

  // ---- 3. sep and delimiter ------------------------------------------------------------------
  compare('sep', (p) => p.sep);
  compare('delimiter', (p) => p.delimiter);
  each('sep', 'sep is always "/"', 'output', (p) => ({
    expected: '/',
    observed: p.sep,
  }));
  each(
    'delimiter.named',
    'named export `delimiter` (v1: always ":"; v2: platform)',
    'output',
    (p, lib) => ({
      expected: lib.major === 1 ? ':' : ctx.isWindows ? ';' : ':',
      observed: p.delimiter,
      notes: 'node:path delimiter on this platform is in raw.comparisons',
    })
  );
  each(
    'delimiter.default',
    'default export `.delimiter` (v1: ":"; v2 default is the posix proxy, so ":")',
    'output',
    (p, lib) => ({
      expected: ':',
      observed: lib.esm.default.delimiter,
      notes: 'read from the ESM build (index.mjs) default export',
    })
  );

  // ---- 4. basename trailing slash -----------------------------------------------------------
  compare(`basename('a/b/')`, (p) => p.basename('a/b/'));
  each('basename.trailingSlash', "basename('a/b/') (node: 'b')", 'output', (p, lib) => ({
    expected: lib.major === 1 ? '' : 'b',
    observed: p.basename('a/b/'),
  }));

  // ---- 5. parse ------------------------------------------------------------------------------
  const parseCases = {
    bare: [
      'a.js',
      { root: 'a.js', dir: '.', base: 'a.js', ext: '.js', name: 'a' },
      { root: '', dir: '.', base: 'a.js', ext: '.js', name: 'a' },
    ],
    trailingSlash: [
      'a/b/',
      { root: 'a', dir: 'a', base: '', ext: '', name: '' },
      { root: '', dir: 'a', base: 'b', ext: '', name: 'b' },
    ],
    absolute: [
      '/a/b.js',
      { root: '/', dir: '/a', base: 'b.js', ext: '.js', name: 'b' },
      { root: '/', dir: '/a', base: 'b.js', ext: '.js', name: 'b' },
    ],
    lowerDrive: [
      'c:\\a\\b.js',
      { root: 'C:', dir: 'C:/a', base: 'b.js', ext: '.js', name: 'b' },
      { root: 'c:/', dir: 'C:/a', base: 'b.js', ext: '.js', name: 'b' },
    ],
  };
  for (const [name, [input, v1, v2]] of Object.entries(parseCases)) {
    compare(`parse(${JSON.stringify(input)})`, (p) => ({ ...p.parse(input) }));
    each(`parse.${name}`, `parse(${JSON.stringify(input)})`, 'output', (p, lib) => ({
      expected: lib.major === 1 ? v1 : v2,
      observed: { ...p.parse(input) },
    }));
  }

  // ---- 6. extname('foo.') ----------------------------------------------------------------------
  compare(`extname('foo.')`, (p) => p.extname('foo.'));
  each('extname.trailingDot', "extname('foo.') (node: '.')", 'output', (p, lib) => ({
    expected: lib.major === 1 ? '' : '.',
    observed: p.extname('foo.'),
  }));

  // ---- 7. leading '//' -------------------------------------------------------------------------
  compare(`normalize('//a/b')`, (p) => p.normalize('//a/b'));
  compare(`join('//a', 'b')`, (p) => p.join('//a', 'b'));
  compare(`resolve('//a/b')`, (p) => p.resolve('//a/b'));
  each(
    'leadingDoubleSlash.normalize',
    "normalize('//a/b') keeps the leading '//'",
    'output',
    (p) => ({
      expected: '//a/b',
      observed: p.normalize('//a/b'),
    })
  );
  each('leadingDoubleSlash.join', "join('//a', 'b') keeps '//' in v2 only", 'output', (p, lib) => ({
    expected: lib.major === 1 ? '/a/b' : '//a/b',
    observed: p.join('//a', 'b'),
    notes: 'v1 join collapses /\\/\\/+/ before normalizing',
  }));
  each('leadingDoubleSlash.resolve', "resolve('//a/b') drops the leading '//'", 'output', (p) => ({
    expected: '/a/b',
    observed: p.resolve('//a/b'),
  }));

  // ---- 8. relative() case sensitivity -------------------------------------------------------
  compare(`relative('C:/Foo/Bar', 'C:/foo/bar/baz')`, (p) =>
    p.relative('C:/Foo/Bar', 'C:/foo/bar/baz')
  );
  compare(`relative('c:/a', 'C:/a/b')`, (p) => p.relative('c:/a', 'C:/a/b'));
  each(
    'relative.caseSensitive',
    "relative('C:/Foo/Bar', 'C:/foo/bar/baz') is case-sensitive",
    'output',
    (p) => ({
      expected: '../../foo/bar/baz',
      observed: p.relative('C:/Foo/Bar', 'C:/foo/bar/baz'),
      notes: "node:path win32 returns 'baz'",
    })
  );
  each(
    'relative.driveLetterCase',
    "relative('c:/a', 'C:/a/b'): only the drive letter is case-normalized",
    'output',
    (p) => ({
      expected: 'b',
      observed: p.relative('c:/a', 'C:/a/b'),
    })
  );

  // ---- 9. relative() across drives ----------------------------------------------------------
  compare(`relative('C:/a', 'D:/b')`, (p) => p.relative('C:/a', 'D:/b'));
  compare(`relative('/a', 'D:/b')`, (p) => p.relative('/a', 'D:/b'));
  compare(`relative('a', 'D:/b')`, (p) => p.relative('a', 'D:/b'));
  each(
    'relative.crossDrive',
    "relative('C:/a', 'D:/b') returns the absolute target",
    'output',
    (p) => ({
      expected: 'D:/b',
      observed: p.relative('C:/a', 'D:/b'),
      notes: 'source special-cases two different drive letters',
    })
  );
  each(
    'relative.rootedToDrive',
    "relative('/a', 'D:/b') (drive-less root) yields a broken '../../D:/b'",
    'output',
    (p) => ({
      expected: '../../D:/b',
      observed: p.relative('/a', 'D:/b'),
      notes: "node:path win32 resolves '/a' onto the current drive and returns 'D:\\\\b'",
    })
  );
  each(
    'relative.cwdToDrive',
    "relative('a', 'D:/b'): broken on POSIX, absolute on Windows (cwd has a drive)",
    'output',
    (p) => {
      const observed = p.relative('a', 'D:/b');
      const cwdDrive = /^[A-Za-z]:/.exec(process.cwd())?.[0]?.toUpperCase();
      return {
        expected: ctx.isWindows
          ? cwdDrive === 'D:'
            ? 'b'
            : 'D:/b'
          : 'broken (starts with ../ and ends with D:/b)',
        observed: ctx.isWindows
          ? observed
          : /^(\.\.\/)+D:\/b$/.test(observed)
            ? 'broken (starts with ../ and ends with D:/b)'
            : observed,
        notes: 'raw value in raw.comparisons',
      };
    }
  );

  // ---- 10. win32 / posix exports ------------------------------------------------------------
  each(
    'exports.win32posix',
    'named win32/posix exports exist (v1: no, v2: yes)',
    'output',
    (p, lib) => ({
      expected: lib.major === 1 ? { win32: false, posix: false } : { win32: true, posix: true },
      observed: { win32: 'win32' in p, posix: 'posix' in p },
    })
  );
  each(
    'exports.win32IsNotNodeWin32',
    'v2 `win32` only changes delimiter: sep and join still use "/"',
    'output',
    (p, lib) => {
      if (lib.major === 1)
        return {
          expected: 'no-win32-export',
          observed: p.win32 ? 'has-win32' : 'no-win32-export',
        };
      return {
        expected: {
          sep: '/',
          join: 'a/b',
          delimiter: ';',
          posixDelimiter: ':',
        },
        observed: {
          sep: p.win32.sep,
          join: p.win32.join('a', 'b'),
          delimiter: p.win32.delimiter,
          posixDelimiter: p.posix.delimiter,
        },
      };
    }
  );

  // ---- 11. resolve() uses process.cwd() with '/' --------------------------------------------
  compare(`resolve('x')`, (p) => p.resolve('x'));
  compare(`resolve('/x')`, (p) => p.resolve('/x'));
  each(
    'resolve.relativeUsesCwd',
    "resolve('x') === process.cwd() with '/' + '/x'",
    'output',
    (p) => ({
      expected: `${ctx.toForward(process.cwd())}/x`,
      observed: p.resolve('x'),
      notes:
        'pathe cwd() only replaces backslashes; a lowercase drive from process.cwd() would stay lowercase',
    })
  );
  each(
    'resolve.rootedNoDrive',
    "resolve('/x') stays drive-less '/x' (node win32 adds the current drive)",
    'output',
    (p) => ({
      expected: '/x',
      observed: p.resolve('/x'),
    })
  );

  return raw;
}
