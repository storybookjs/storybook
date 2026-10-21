// Probe: Node's built-in `node:path`.
// Checks separator style of join/resolve/dirname/relative/normalize outputs, acceptance of `/` input on
// Windows, sep/delimiter, case- and drive-insensitivity of win32 relative(), basename trailing slash,
// parse('a.js'), and that path.win32/path.posix exist everywhere. Every Windows-semantics claim is
// recorded twice: once through the platform `path` (meaningful on Windows only) and once through
// `path.win32` (same prediction on every platform). Inputs are only absolute drive/UNC paths for
// `path.win32`, because on POSIX `win32.resolve` falls back to the POSIX cwd for anything else.
import path from 'node:path';

export function versions() {
  return { node: process.version };
}

export async function run(ctx) {
  const { isWindows, workDir, separatorStyle, toForward, toBackslash } = ctx;
  const native = isWindows ? 'backslash' : 'forward';
  const skipped = 'skipped-on-posix';
  const raw = { workDir, platformIsWin32: path === path.win32 };

  /** Runs one independent step; records the claim, or a claimError if the step throws. */
  const step = (spec, compute) => {
    try {
      const observed = compute();
      raw[spec.id] = observed;
      ctx.claim({ ...spec, observed });
    } catch (error) {
      ctx.claimError({ ...spec, error });
    }
  };
  /** Same as step(), but only on Windows; on POSIX records the skip marker. */
  const winOnly = (spec, compute) =>
    isWindows
      ? step(spec, compute)
      : ctx.claim({
          ...spec,
          expected: skipped,
          observed: skipped,
          notes: 'Windows path syntax; not a path on POSIX',
        });

  const file = path.join(workDir, 'sub', 'file.js');

  // ---- Claim 1: output separators (platform path) ----
  step(
    {
      id: 'node-path.platform.join.output',
      claim: "join('a','b','c') uses the native separator",
      kind: 'output',
      expected: isWindows ? 'a\\b\\c' : 'a/b/c',
    },
    () => path.join('a', 'b', 'c')
  );
  step(
    {
      id: 'node-path.platform.resolve.output',
      claim: "resolve(workDir, 'sub/file.js') is native",
      kind: 'output',
      expected: native,
    },
    () => separatorStyle(path.resolve(workDir, 'sub/file.js'))
  );
  step(
    {
      id: 'node-path.platform.dirname.output',
      claim: 'dirname(native path) is native',
      kind: 'output',
      expected: native,
    },
    () => separatorStyle(path.dirname(file))
  );
  step(
    {
      id: 'node-path.platform.dirname.forwardInput',
      claim:
        'dirname() does NOT normalize: forward-slash input stays forward-slash, even on Windows',
      kind: 'output',
      expected: 'forward',
      notes: 'dirname only slices its input; contradicts a blanket reading of claim 1',
    },
    () => separatorStyle(path.dirname(toForward(file)))
  );
  step(
    {
      id: 'node-path.platform.relative.output',
      claim: 'relative(workDir, workDir/sub/file.js) is native',
      kind: 'output',
      expected: isWindows ? 'sub\\file.js' : 'sub/file.js',
    },
    () => path.relative(workDir, file)
  );
  step(
    {
      id: 'node-path.platform.normalize.output',
      claim: "normalize('a/b/../c/d') is native",
      kind: 'output',
      expected: isWindows ? 'a\\c\\d' : 'a/c/d',
    },
    () => path.normalize('a/b/../c/d')
  );

  // ---- Claim 1: output separators (win32 / posix explicitly) ----
  step(
    {
      id: 'node-path.win32.join.output',
      claim: "win32.join('a','b','c') → 'a\\b\\c'",
      kind: 'output',
      expected: 'a\\b\\c',
    },
    () => path.win32.join('a', 'b', 'c')
  );
  step(
    {
      id: 'node-path.win32.resolve.output',
      claim: "win32.resolve('C:\\a','b/c') → 'C:\\a\\b\\c'",
      kind: 'output',
      expected: 'C:\\a\\b\\c',
    },
    () => path.win32.resolve('C:\\a', 'b/c')
  );
  step(
    {
      id: 'node-path.win32.dirname.output',
      claim: "win32.dirname('C:\\a\\b\\c') → 'C:\\a\\b'",
      kind: 'output',
      expected: 'C:\\a\\b',
    },
    () => path.win32.dirname('C:\\a\\b\\c')
  );
  step(
    {
      id: 'node-path.win32.dirname.forwardInput',
      claim: "win32.dirname('C:/a/b/c') → 'C:/a/b' (not normalized)",
      kind: 'output',
      expected: 'C:/a/b',
    },
    () => path.win32.dirname('C:/a/b/c')
  );
  step(
    {
      id: 'node-path.win32.relative.output',
      claim: "win32.relative('C:\\a','C:\\a\\b\\c') → 'b\\c'",
      kind: 'output',
      expected: 'b\\c',
    },
    () => path.win32.relative('C:\\a', 'C:\\a\\b\\c')
  );
  step(
    {
      id: 'node-path.win32.normalize.output',
      claim: "win32.normalize('a/b/../c/d') → 'a\\c\\d'",
      kind: 'output',
      expected: 'a\\c\\d',
    },
    () => path.win32.normalize('a/b/../c/d')
  );
  step(
    {
      id: 'node-path.posix.join.output',
      claim: "posix.join('a','b','c') → 'a/b/c'",
      kind: 'output',
      expected: 'a/b/c',
    },
    () => path.posix.join('a', 'b', 'c')
  );

  // ---- Claim 2: '/' input accepted on Windows and normalized to '\' ----
  step(
    {
      id: 'node-path.platform.resolve.forwardInput',
      claim: 'resolve(toForward(workDir)) === workDir (native)',
      kind: 'input',
      expected: { style: native, equalsNative: true },
    },
    () => {
      const r = path.resolve(toForward(workDir));
      return { style: separatorStyle(r), equalsNative: r === workDir };
    }
  );
  winOnly(
    {
      id: 'node-path.platform.resolve.backslashInput',
      claim: 'resolve(toBackslash(workDir)) === workDir',
      kind: 'input',
      expected: { style: native, equalsNative: true },
    },
    () => {
      const r = path.resolve(toBackslash(workDir));
      return { style: separatorStyle(r), equalsNative: r === workDir };
    }
  );
  step(
    {
      id: 'node-path.platform.join.forwardInput',
      claim: "join(toForward(workDir), 'b/c') === join(workDir, 'b', 'c')",
      kind: 'input',
      expected: { style: native, equalsNative: true },
    },
    () => {
      const r = path.join(toForward(workDir), 'b/c');
      return {
        style: separatorStyle(r),
        equalsNative: r === path.join(workDir, 'b', 'c'),
      };
    }
  );
  winOnly(
    {
      id: 'node-path.platform.resolve.driveForward',
      claim: "resolve('C:/a/b') → 'C:\\a\\b'",
      kind: 'input',
      expected: 'C:\\a\\b',
    },
    () => path.resolve('C:/a/b')
  );
  step(
    {
      id: 'node-path.win32.resolve.forwardInput',
      claim: "win32.resolve('C:/a/b') → 'C:\\a\\b'",
      kind: 'input',
      expected: 'C:\\a\\b',
    },
    () => path.win32.resolve('C:/a/b')
  );
  step(
    {
      id: 'node-path.win32.join.forwardInput',
      claim: "win32.join('C:/a','b/c') → 'C:\\a\\b\\c'",
      kind: 'input',
      expected: 'C:\\a\\b\\c',
    },
    () => path.win32.join('C:/a', 'b/c')
  );
  step(
    {
      id: 'node-path.win32.normalize.mixedInput',
      claim: "win32.normalize('C:/a\\\\b//c/') → 'C:\\a\\b\\c\\'",
      kind: 'input',
      expected: 'C:\\a\\b\\c\\',
    },
    () => path.win32.normalize('C:/a\\\\b//c/')
  );

  // ---- Claim 3: sep and delimiter ----
  step(
    {
      id: 'node-path.platform.sepDelimiter',
      claim: 'path.sep / path.delimiter are platform-specific',
      kind: 'output',
      expected: isWindows ? { sep: '\\', delimiter: ';' } : { sep: '/', delimiter: ':' },
    },
    () => ({ sep: path.sep, delimiter: path.delimiter })
  );
  step(
    {
      id: 'node-path.win32.sepDelimiter',
      claim: "win32.sep === '\\', win32.delimiter === ';'",
      kind: 'output',
      expected: { sep: '\\', delimiter: ';' },
    },
    () => ({ sep: path.win32.sep, delimiter: path.win32.delimiter })
  );
  step(
    {
      id: 'node-path.posix.sepDelimiter',
      claim: "posix.sep === '/', posix.delimiter === ':'",
      kind: 'output',
      expected: { sep: '/', delimiter: ':' },
    },
    () => ({ sep: path.posix.sep, delimiter: path.posix.delimiter })
  );

  // ---- Claim 4: relative() is case-insensitive on Windows ----
  winOnly(
    {
      id: 'node-path.platform.relative.caseInsensitive',
      claim: "relative('C:\\Foo\\Bar','c:\\foo\\bar\\baz') → 'baz'",
      kind: 'input',
      expected: 'baz',
    },
    () => path.relative('C:\\Foo\\Bar', 'c:\\foo\\bar\\baz')
  );
  winOnly(
    {
      id: 'node-path.platform.relative.driveCaseOnly',
      claim: 'relative(workDir with lower-case drive, workDir/sub/file.js) → sub\\file.js',
      kind: 'input',
      expected: 'sub\\file.js',
    },
    () =>
      path.relative(
        workDir.replace(/^[A-Za-z]:/, (d) => d.toLowerCase()),
        file
      )
  );
  step(
    {
      id: 'node-path.platform.relative.rootedCase',
      claim: "relative('/Foo/Bar','/foo/bar/baz') is case-insensitive on Windows only",
      kind: 'input',
      expected: isWindows ? 'baz' : '../../foo/bar/baz',
      notes: 'POSIX-rooted input; on Windows resolve() prefixes the cwd drive',
    },
    () => path.relative('/Foo/Bar', '/foo/bar/baz')
  );
  step(
    {
      id: 'node-path.win32.relative.caseInsensitive',
      claim: "win32.relative('C:\\Foo\\Bar','c:\\foo\\bar\\baz') → 'baz'",
      kind: 'input',
      expected: 'baz',
    },
    () => path.win32.relative('C:\\Foo\\Bar', 'c:\\foo\\bar\\baz')
  );
  step(
    {
      id: 'node-path.win32.relative.driveCaseOnly',
      claim: "win32.relative('C:\\a\\b','c:\\a\\b\\c') → 'c'",
      kind: 'input',
      expected: 'c',
    },
    () => path.win32.relative('C:\\a\\b', 'c:\\a\\b\\c')
  );
  step(
    {
      id: 'node-path.win32.relative.sameDifferentCase',
      claim: "win32.relative('C:\\Foo','c:\\foo') → ''",
      kind: 'input',
      expected: '',
    },
    () => path.win32.relative('C:\\Foo', 'c:\\foo')
  );
  step(
    {
      id: 'node-path.win32.relative.preservesTargetCase',
      claim: "win32.relative('C:\\Foo','c:\\foo\\Bar\\Baz') → 'Bar\\Baz' (target casing kept)",
      kind: 'output',
      expected: 'Bar\\Baz',
    },
    () => path.win32.relative('C:\\Foo', 'c:\\foo\\Bar\\Baz')
  );
  step(
    {
      id: 'node-path.posix.relative.caseSensitive',
      claim: "posix.relative('/Foo/Bar','/foo/bar/baz') → '../../foo/bar/baz'",
      kind: 'input',
      expected: '../../foo/bar/baz',
    },
    () => path.posix.relative('/Foo/Bar', '/foo/bar/baz')
  );

  // ---- Claim 5: relative() across drives returns the absolute target ----
  winOnly(
    {
      id: 'node-path.platform.relative.crossDrive',
      claim: "relative('C:\\a','D:\\b') → 'D:\\b'",
      kind: 'output',
      expected: 'D:\\b',
    },
    () => path.relative('C:\\a', 'D:\\b')
  );
  step(
    {
      id: 'node-path.win32.relative.crossDrive',
      claim: "win32.relative('C:\\a','D:\\b') → 'D:\\b'",
      kind: 'output',
      expected: 'D:\\b',
    },
    () => path.win32.relative('C:\\a', 'D:\\b')
  );
  step(
    {
      id: 'node-path.win32.relative.crossDriveForward',
      claim: "win32.relative('C:/a','D:/b') → 'D:\\b' (normalized)",
      kind: 'output',
      expected: 'D:\\b',
    },
    () => path.win32.relative('C:/a', 'D:/b')
  );
  step(
    {
      id: 'node-path.win32.relative.driveToUnc',
      claim: "win32.relative('C:\\a','\\\\srv\\share\\b') → '\\\\srv\\share\\b'",
      kind: 'output',
      expected: '\\\\srv\\share\\b',
    },
    () => path.win32.relative('C:\\a', '\\\\srv\\share\\b')
  );

  // ---- Claim 6: basename ignores trailing separator ----
  step(
    {
      id: 'node-path.platform.basename.trailingSlash',
      claim: "basename('a/b/') → 'b'",
      kind: 'output',
      expected: 'b',
    },
    () => path.basename('a/b/')
  );
  step(
    {
      id: 'node-path.win32.basename.trailingSlash',
      claim: "win32.basename('a/b/') → 'b'",
      kind: 'output',
      expected: 'b',
    },
    () => path.win32.basename('a/b/')
  );
  step(
    {
      id: 'node-path.posix.basename.trailingSlash',
      claim: "posix.basename('a/b/') → 'b'",
      kind: 'output',
      expected: 'b',
    },
    () => path.posix.basename('a/b/')
  );
  step(
    {
      id: 'node-path.platform.basename.trailingBackslash',
      claim:
        "basename('a\\b\\') → 'b' on Windows; unchanged on POSIX (backslash is a filename char)",
      kind: 'input',
      expected: isWindows ? 'b' : 'a\\b\\',
    },
    () => path.basename('a\\b\\')
  );

  // ---- Claim 7: parse('a.js') ----
  const parsedExpected = {
    root: '',
    dir: '',
    base: 'a.js',
    ext: '.js',
    name: 'a',
  };
  const sameFields = (o) =>
    Object.keys(parsedExpected).every((k) => o[k] === parsedExpected[k]) &&
    Object.keys(o).length === 5;
  for (const [label, impl] of [
    ['platform', path],
    ['win32', path.win32],
    ['posix', path.posix],
  ]) {
    step(
      {
        id: `node-path.${label}.parse.bareFile`,
        claim: `${label === 'platform' ? '' : `${label}.`}parse('a.js') → { root:'', dir:'', base:'a.js', ext:'.js', name:'a' }`,
        kind: 'output',
        expected: parsedExpected,
        check: sameFields,
      },
      () => ({ ...impl.parse('a.js') })
    );
  }

  // ---- Claim 8: path.win32 / path.posix availability ----
  step(
    {
      id: 'node-path.variants.available',
      claim: 'path.win32 and path.posix are present with full APIs',
      kind: 'output',
      expected: { win32: true, posix: true },
    },
    () => {
      const api = [
        'join',
        'resolve',
        'dirname',
        'basename',
        'relative',
        'normalize',
        'parse',
        'format',
        'isAbsolute',
      ];
      return {
        win32: api.every((k) => typeof path.win32[k] === 'function'),
        posix: api.every((k) => typeof path.posix[k] === 'function'),
      };
    }
  );
  step(
    {
      id: 'node-path.variants.platformIdentity',
      claim: 'path === path.win32 on Windows, path === path.posix on POSIX',
      kind: 'output',
      expected: isWindows ? 'win32' : 'posix',
    },
    () => (path === path.win32 ? 'win32' : path === path.posix ? 'posix' : 'neither')
  );
  try {
    const [w, p] = await Promise.all([import('node:path/win32'), import('node:path/posix')]);
    step(
      {
        id: 'node-path.variants.subpathModules',
        claim: "'node:path/win32' and 'node:path/posix' export the same objects",
        kind: 'output',
        expected: { win32: true, posix: true },
      },
      () => ({
        win32: w.default === path.win32,
        posix: p.default === path.posix,
      })
    );
  } catch (error) {
    ctx.claimError({
      id: 'node-path.variants.subpathModules',
      claim: "'node:path/win32' and 'node:path/posix' import",
      kind: 'output',
      expected: { win32: true, posix: true },
      error,
    });
  }

  return raw;
}
