// Probe: separator style of paths returned by Node built-ins (process, os, CJS/ESM module
// metadata, url, fs.realpath*, recursive fs.readdir), and which path forms Node accepts as
// input (fs with `/` and mixed separators, import() of raw absolute paths, spawning a script by
// a `/` path). Everything runs offline against fixtures in ctx.workDir.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SKIP = 'skipped-on-posix';

export function versions() {
  return { node: process.version };
}

export async function run(ctx) {
  const W = ctx.isWindows;
  const nativeStyle = W ? 'backslash' : 'forward';
  const style = ctx.separatorStyle;
  const raw = {};

  async function step(spec, fn) {
    try {
      const { observed, check, notes } = await fn();
      ctx.claim({ ...spec, observed, check, notes: notes ?? spec.notes });
    } catch (error) {
      ctx.claimError({ ...spec, error });
    }
  }
  function skip(spec) {
    ctx.claim({ ...spec, expected: SKIP, observed: SKIP });
  }
  const errCode = (e) => e?.code ?? e?.name ?? String(e);
  /** Runs `fn` and returns 'ok' or the error code. */
  function attempt(fn) {
    try {
      fn();
      return 'ok';
    } catch (e) {
      return errCode(e);
    }
  }
  /** Lowercases (or uppercases) the drive letter of a Windows absolute path. */
  const withDrive = (p, upper) =>
    /^[a-zA-Z]:/.test(p) ? (upper ? p[0].toUpperCase() : p[0].toLowerCase()) + p.slice(1) : p;
  const driveCase = (p) => (/^[A-Z]:/.test(p) ? 'upper' : /^[a-z]:/.test(p) ? 'lower' : 'no-drive');
  const nodeEval = (code, opts = {}) =>
    spawnSync(process.execPath, ['-e', code], {
      encoding: 'utf8',
      timeout: 30_000,
      ...opts,
    });

  const work = ctx.workDir;
  const fwd = ctx.toForward(work);

  // ---------------------------------------------------------------------------------------------
  // 1. Paths returned by process / os / module metadata
  // ---------------------------------------------------------------------------------------------
  raw.process = {
    cwd: process.cwd(),
    execPath: process.execPath,
    argv1: process.argv[1],
  };
  raw.os = { tmpdir: os.tmpdir(), homedir: os.homedir() };

  for (const [id, value, notes] of [
    ['node.process.cwd', raw.process.cwd, 'run.mjs spawns the probe with a native cwd'],
    [
      'node.os.tmpdir',
      raw.os.tmpdir,
      'env TEMP/TMP (Windows) or TMPDIR (POSIX) is returned verbatim',
    ],
    [
      'node.os.homedir',
      raw.os.homedir,
      'env USERPROFILE (Windows) or HOME (POSIX) is returned verbatim',
    ],
    ['node.process.execPath', raw.process.execPath],
    ['node.process.argv1', raw.process.argv1, 'argv[1] of this probe process (lib/child.mjs)'],
  ]) {
    await step(
      {
        id,
        claim: `${id.replace(/^node\./, '')} returns a native path`,
        kind: 'output',
        expected: nativeStyle,
      },
      () => ({ observed: style(value), notes })
    );
  }

  await step(
    {
      id: 'node.process.chdir.forwardInput',
      claim: 'process.chdir() with a "/" path, then process.cwd() returns a native path',
      kind: 'output',
      expected: nativeStyle,
    },
    () => {
      const before = process.cwd();
      try {
        process.chdir(fwd);
        raw.process.cwdAfterForwardChdir = process.cwd();
      } finally {
        process.chdir(before);
      }
      return { observed: style(raw.process.cwdAfterForwardChdir) };
    }
  );

  // os.tmpdir()/os.homedir() do not normalize env vars: feed them a "/" value in a child process.
  const fakeDir = `${fwd}/fake-env-dir`;
  raw.envOverride = {};
  for (const [id, fnName, envVars] of [
    ['node.os.tmpdir.envVerbatim', 'tmpdir', W ? ['TEMP', 'TMP'] : ['TMPDIR']],
    ['node.os.homedir.envVerbatim', 'homedir', W ? ['USERPROFILE'] : ['HOME']],
  ]) {
    await step(
      {
        id,
        claim: `os.${fnName}() returns ${envVars.join('/')} verbatim, so a "/" env value yields a "/" result`,
        kind: 'output',
        expected: { verbatim: true, style: 'forward' },
      },
      () => {
        const env = { ...process.env };
        for (const name of envVars) env[name] = fakeDir;
        const child = nodeEval(`process.stdout.write(require('node:os').${fnName}())`, { env });
        raw.envOverride[fnName] = {
          set: fakeDir,
          got: child.stdout,
          stderr: child.stderr,
        };
        return {
          observed: {
            verbatim: child.stdout === fakeDir,
            style: style(child.stdout),
          },
        };
      }
    );
  }

  // CJS __dirname / __filename, loaded by native path and by "/" path.
  const cjsDir = path.join(work, 'cjs');
  fs.mkdirSync(cjsDir, { recursive: true });
  const cjsSource = 'module.exports = { dirname: __dirname, filename: __filename };\n';
  fs.writeFileSync(path.join(cjsDir, 'by-native.cjs'), cjsSource);
  fs.writeFileSync(path.join(cjsDir, 'by-forward.cjs'), cjsSource);
  const req = createRequire(import.meta.url);
  raw.cjs = {};
  for (const [variant, file] of [
    ['native', path.join(cjsDir, 'by-native.cjs')],
    ['forwardInput', ctx.toForward(path.join(cjsDir, 'by-forward.cjs'))],
  ]) {
    await step(
      {
        id: `node.cjs.__dirname__filename.${variant}`,
        claim: `CJS __dirname and __filename are native (module required by ${variant} path)`,
        kind: 'output',
        expected: { dirname: nativeStyle, filename: nativeStyle },
      },
      () => {
        const mod = req(file);
        raw.cjs[variant] = { requiredAs: file, ...mod };
        return {
          observed: {
            dirname: style(mod.dirname),
            filename: style(mod.filename),
          },
        };
      }
    );
  }
  await step(
    {
      id: 'node.cjs.require.resolve.forwardInput',
      claim: 'require.resolve() of a "/" absolute path returns a native path',
      kind: 'output',
      expected: nativeStyle,
    },
    () => {
      raw.cjs.resolved = req.resolve(ctx.toForward(path.join(cjsDir, 'by-forward.cjs')));
      return { observed: style(raw.cjs.resolved) };
    }
  );

  // ESM import.meta.dirname / filename, imported by a file URL built from native and "/" paths.
  const esmDir = path.join(work, 'esm');
  fs.mkdirSync(esmDir, { recursive: true });
  const esmSource =
    'export const dirname = import.meta.dirname;\n' +
    'export const filename = import.meta.filename;\n' +
    'export const url = import.meta.url;\n';
  fs.writeFileSync(path.join(esmDir, 'by-native.mjs'), esmSource);
  fs.writeFileSync(path.join(esmDir, 'by-forward.mjs'), esmSource);
  raw.esm = {};
  for (const [variant, file] of [
    ['native', path.join(esmDir, 'by-native.mjs')],
    ['forwardInput', ctx.toForward(path.join(esmDir, 'by-forward.mjs'))],
  ]) {
    await step(
      {
        id: `node.esm.importMeta.${variant}`,
        claim: `import.meta.dirname/filename are native (module imported via pathToFileURL of ${variant} path)`,
        kind: 'output',
        expected: { dirname: nativeStyle, filename: nativeStyle },
      },
      async () => {
        const href = pathToFileURL(file).href;
        const mod = await import(href);
        raw.esm[variant] = {
          importedAs: href,
          dirname: mod.dirname,
          filename: mod.filename,
          url: mod.url,
        };
        return {
          observed: {
            dirname: style(mod.dirname),
            filename: style(mod.filename),
          },
        };
      }
    );
  }

  // ---------------------------------------------------------------------------------------------
  // 2. file URL <-> path conversion
  // ---------------------------------------------------------------------------------------------
  raw.url = {};
  await step(
    {
      id: 'node.url.roundtrip',
      claim: 'fileURLToPath(pathToFileURL(nativePath)) returns the same native path',
      kind: 'output',
      expected: { style: nativeStyle, equal: true },
    },
    () => {
      const href = pathToFileURL(work).href;
      const back = fileURLToPath(href);
      raw.url.roundtrip = { input: work, href, back };
      return { observed: { style: style(back), equal: back === work } };
    }
  );
  await step(
    {
      id: 'node.url.pathToFileURL.forwardInput',
      claim: 'pathToFileURL() gives the same href for "/" and native forms of an absolute path',
      kind: 'input',
      expected: true,
    },
    () => {
      const a = pathToFileURL(work).href;
      const b = pathToFileURL(fwd).href;
      raw.url.forwardInput = { native: a, forward: b };
      return { observed: a === b };
    }
  );
  await step(
    {
      id: 'node.url.fileURLToPath.driveUrl',
      claim: "fileURLToPath('file:///C:/x/y') is 'C:\\x\\y' on Windows and '/C:/x/y' on POSIX",
      kind: 'output',
      expected: W ? 'C:\\x\\y' : '/C:/x/y',
    },
    () => ({ observed: (raw.url.driveUrl = fileURLToPath('file:///C:/x/y')) })
  );
  await step(
    {
      id: 'node.url.windowsOption',
      claim:
        'fileURLToPath/pathToFileURL { windows } option forces win32 conversion on any platform; drive-letter case is preserved',
      kind: 'output',
      expected: {
        upper: 'C:\\x\\y',
        lower: 'c:\\x\\y',
        posix: '/C:/x/y',
        toUrl: 'file:///c:/x/y',
      },
    },
    () => {
      const observed = {
        upper: fileURLToPath('file:///C:/x/y', { windows: true }),
        lower: fileURLToPath('file:///c:/x/y', { windows: true }),
        posix: fileURLToPath('file:///C:/x/y', { windows: false }),
        toUrl: pathToFileURL('c:\\x\\y', { windows: true }).href,
      };
      raw.url.windowsOption = observed;
      return { observed };
    }
  );

  // ---------------------------------------------------------------------------------------------
  // 3. realpath variants
  // ---------------------------------------------------------------------------------------------
  const realDir = path.join(work, 'Real-Path-Dir');
  const realFile = path.join(realDir, 'file.txt');
  fs.mkdirSync(realDir, { recursive: true });
  fs.writeFileSync(realFile, 'x');
  const realpaths = async (p) => {
    const out = {};
    for (const [name, fn] of [
      ['sync', () => fs.realpathSync(p)],
      ['native', () => fs.realpathSync.native(p)],
      ['promises', () => fs.promises.realpath(p)],
    ]) {
      try {
        out[name] = await fn();
      } catch (e) {
        out[name] = `ERROR ${errCode(e)}`;
      }
    }
    return out;
  };
  raw.realpath = {};
  await step(
    {
      id: 'node.fs.realpath.forwardInput',
      claim:
        'realpathSync / realpathSync.native / promises.realpath return native paths for "/" input',
      kind: 'output',
      expected: {
        sync: nativeStyle,
        native: nativeStyle,
        promises: nativeStyle,
      },
    },
    async () => {
      const input = ctx.toForward(realFile);
      const out = (raw.realpath.forwardInput = {
        input,
        ...(await realpaths(input)),
      });
      return {
        observed: {
          sync: style(out.sync),
          native: style(out.native),
          promises: style(out.promises),
        },
      };
    }
  );

  const realSpec = (id, claim, expected) => ({
    id,
    claim,
    kind: 'output',
    expected,
  });
  if (W) {
    await step(
      realSpec(
        'node.fs.realpath.lowercaseDrive',
        'with a lowercase drive letter input, JS realpathSync keeps it; native and promises return the on-disk (uppercase) drive',
        { sync: 'lower', native: 'upper', promises: 'upper' }
      ),
      async () => {
        const input = withDrive(realFile, false);
        const out = (raw.realpath.lowercaseDrive = {
          input,
          ...(await realpaths(input)),
        });
        return {
          observed: {
            sync: driveCase(out.sync),
            native: driveCase(out.native),
            promises: driveCase(out.promises),
          },
        };
      }
    );
    await step(
      realSpec(
        'node.fs.realpath.componentCase',
        'with a wrongly-cased directory name, JS realpathSync keeps the input case; native and promises return on-disk case',
        { sync: 'as-input', native: 'on-disk', promises: 'on-disk' }
      ),
      async () => {
        const input = path.join(work, 'REAL-PATH-DIR', 'file.txt');
        const out = (raw.realpath.componentCase = {
          input,
          ...(await realpaths(input)),
        });
        const kind = (p) =>
          p.includes('Real-Path-Dir') ? 'on-disk' : p.includes('REAL-PATH-DIR') ? 'as-input' : p;
        return {
          observed: {
            sync: kind(out.sync),
            native: kind(out.native),
            promises: kind(out.promises),
          },
        };
      }
    );
    await step(
      realSpec(
        'node.fs.realpath.shortName',
        'for an 8.3 short-name input, JS realpathSync keeps the "~" form; native and promises expand to the long name',
        { sync: true, native: false, promises: false }
      ),
      async () => {
        // Ask Windows for the 8.3 short name of the fixture directory.
        const ps = spawnSync(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `(New-Object -ComObject Scripting.FileSystemObject).GetFolder('${realDir.replace(/'/g, "''")}').ShortPath`,
          ],
          { encoding: 'utf8', timeout: 60_000 }
        );
        const shortDir = (ps.stdout ?? '').trim();
        raw.realpath.shortName = {
          shortDir,
          psStatus: ps.status,
          psError: ps.error ? String(ps.error) : undefined,
        };
        if (!shortDir.includes('~')) {
          return {
            observed: 'no-short-name-available',
            notes:
              '8.3 names disabled on this volume or PowerShell failed; see raw.realpath.shortName',
          };
        }
        const input = path.join(shortDir, 'file.txt');
        const out = { input, ...(await realpaths(input)) };
        Object.assign(raw.realpath.shortName, out);
        return {
          observed: {
            sync: out.sync.includes('~'),
            native: out.native.includes('~'),
            promises: out.promises.includes('~'),
          },
        };
      }
    );
  } else {
    skip(
      realSpec('node.fs.realpath.lowercaseDrive', 'drive-letter case handling of realpath variants')
    );
    skip(
      realSpec(
        'node.fs.realpath.componentCase',
        'directory-name case handling of realpath variants'
      )
    );
    skip(realSpec('node.fs.realpath.shortName', '8.3 short-name expansion of realpath variants'));
  }
  // os.tmpdir() is the classic 8.3 case (e.g. C:\Users\RUNNER~1\AppData\Local\Temp on CI).
  raw.realpath.tmpdir = {
    input: os.tmpdir(),
    ...(await realpaths(os.tmpdir())),
  };

  // ---------------------------------------------------------------------------------------------
  // 4. Recursive readdir: names and Dirent.parentPath
  // ---------------------------------------------------------------------------------------------
  const rd = path.join(work, 'rd');
  fs.mkdirSync(path.join(rd, 'a', 'b'), { recursive: true });
  fs.writeFileSync(path.join(rd, 'top.txt'), 'x');
  fs.writeFileSync(path.join(rd, 'a', 'b', 'deep.txt'), 'x');
  raw.readdir = {};
  for (const [variant, input] of [
    ['native', rd],
    ['forwardInput', ctx.toForward(rd)],
  ]) {
    await step(
      {
        id: `node.fs.readdirSync.recursive.names.${variant}`,
        claim: `readdirSync(dir, { recursive: true }) nested names use native separators (${variant} dir)`,
        kind: 'output',
        expected: nativeStyle,
      },
      () => {
        const names = fs.readdirSync(input, { recursive: true });
        raw.readdir[`names.${variant}`] = names;
        return { observed: style(names.find((n) => n.endsWith('deep.txt'))) };
      }
    );
    // Top-level dirents carry the input string verbatim; nested ones carry path.join() results.
    const parentExpected =
      variant === 'native' || !W
        ? { top: nativeStyle, nested: nativeStyle }
        : { top: 'forward', nested: 'backslash' };
    for (const [api, list] of [
      ['readdirSync', () => fs.readdirSync(input, { recursive: true, withFileTypes: true })],
      [
        'promises.readdir',
        () => fs.promises.readdir(input, { recursive: true, withFileTypes: true }),
      ],
    ]) {
      await step(
        {
          id: `node.fs.${api}.recursive.parentPath.${variant}`,
          claim: `${api} recursive Dirent.parentPath: top-level = input verbatim, nested = path.join() (native) (${variant} dir)`,
          kind: 'output',
          expected: parentExpected,
        },
        async () => {
          const dirents = await list();
          const top = dirents.find((d) => d.name === 'top.txt');
          const nested = dirents.find((d) => d.name === 'deep.txt');
          raw.readdir[`${api}.parentPath.${variant}`] = dirents.map((d) => ({
            name: d.name,
            parentPath: d.parentPath,
          }));
          return {
            observed: {
              top: style(top.parentPath),
              nested: style(nested.parentPath),
            },
          };
        }
      );
    }
  }

  // ---------------------------------------------------------------------------------------------
  // 5. Input forms accepted by fs, require and import()
  // ---------------------------------------------------------------------------------------------
  const fsOps = (dir) => {
    const file = `${dir}${dir.includes('\\') && !dir.endsWith('/') ? '\\' : '/'}f.txt`;
    return {
      mkdir: attempt(() => fs.mkdirSync(dir, { recursive: true })),
      write: attempt(() => fs.writeFileSync(file, 'hello')),
      exists: fs.existsSync(file),
      stat: attempt(() => {
        if (!fs.statSync(file).isFile()) throw new Error('not a file');
      }),
      read: attempt(() => {
        if (fs.readFileSync(file, 'utf8') !== 'hello') throw new Error('content mismatch');
      }),
    };
  };
  const fsOk = {
    mkdir: 'ok',
    write: 'ok',
    exists: true,
    stat: 'ok',
    read: 'ok',
  };
  raw.fsInput = {};
  const fsForms = [
    ['native', path.join(work, 'in-native', 'deep')],
    ['forward', `${fwd}/in-forward/deep`],
    ['mixed', `${fwd}/in-mixed\\deep`],
  ];
  for (const [form, dir] of fsForms) {
    const spec = {
      id: `node.fs.input.${form}`,
      claim: `mkdirSync/writeFileSync/existsSync/statSync/readFileSync accept a ${form}-separator absolute path`,
      kind: 'input',
      expected: fsOk,
    };
    // On POSIX the forward form IS the native form, and "\" is a filename character.
    if (!W && form === 'mixed') {
      skip(spec);
      continue;
    }
    await step(spec, () => {
      const observed = fsOps(dir);
      raw.fsInput[form] = { dir, ...observed };
      return { observed };
    });
  }

  // import() of a raw absolute path (no file:// URL).
  const importTarget = path.join(esmDir, 'raw-import.mjs');
  fs.writeFileSync(importTarget, 'export default 42;\n');
  raw.import = {};
  const tryImport = async (specifier) => {
    try {
      const mod = await import(specifier);
      return { result: mod.default === 42 ? 'ok' : 'wrong-module' };
    } catch (e) {
      return { result: errCode(e), message: e?.message };
    }
  };
  for (const [variant, specifier] of [
    ['native', importTarget],
    ['forward', ctx.toForward(importTarget)],
    ['fileUrl', pathToFileURL(importTarget).href],
  ]) {
    const expected = variant === 'fileUrl' || !W ? 'ok' : 'ERR_UNSUPPORTED_ESM_URL_SCHEME';
    await step(
      {
        id: `node.esm.import.absolute.${variant}`,
        claim: `import() of an absolute ${variant} specifier ${expected === 'ok' ? 'works' : 'fails with ERR_UNSUPPORTED_ESM_URL_SCHEME'}`,
        kind: 'input',
        expected,
      },
      async () => {
        const out = (raw.import[variant] = {
          specifier,
          ...(await tryImport(specifier)),
        });
        return { observed: out.result };
      }
    );
  }
  await step(
    {
      id: 'node.esm.import.driveSpecifier',
      claim:
        "import('C:/…') is parsed as a URL with scheme 'c:' on every platform (ERR_UNSUPPORTED_ESM_URL_SCHEME)",
      kind: 'input',
      expected: 'ERR_UNSUPPORTED_ESM_URL_SCHEME',
    },
    async () => {
      const out = (raw.import.driveSpecifier = {
        specifier: 'C:/does-not-exist/x.mjs',
        ...(await tryImport('C:/does-not-exist/x.mjs')),
      });
      return {
        observed: out.result,
        notes: 'message carries a Windows-only hint on win32; see raw.import',
      };
    }
  );

  // ---------------------------------------------------------------------------------------------
  // 6. Spawning node with a "/" script path
  // ---------------------------------------------------------------------------------------------
  const script = path.join(work, 'spawned.mjs');
  fs.writeFileSync(
    script,
    'process.stdout.write(JSON.stringify({ argv1: process.argv[1], filename: import.meta.filename, cwd: process.cwd() }));\n'
  );
  raw.spawn = {};
  for (const [variant, scriptPath, cwd] of [
    ['native', script, work],
    ['forward', ctx.toForward(script), fwd],
  ]) {
    await step(
      {
        id: `node.child_process.spawnSync.${variant}`,
        claim: `spawnSync(execPath, [${variant} script], { cwd: ${variant} dir }) runs; child argv[1], import.meta.filename and cwd are native`,
        kind: variant === 'native' ? 'output' : 'input',
        expected: {
          status: 0,
          argv1: nativeStyle,
          filename: nativeStyle,
          cwd: nativeStyle,
        },
      },
      () => {
        const child = spawnSync(process.execPath, [scriptPath], {
          cwd,
          encoding: 'utf8',
          timeout: 30_000,
        });
        let out = {};
        try {
          out = JSON.parse(child.stdout);
        } catch {
          // keep empty; raw has stdout/stderr
        }
        raw.spawn[variant] = {
          scriptPath,
          cwd,
          status: child.status,
          stdout: child.stdout,
          stderr: child.stderr,
        };
        return {
          observed: {
            status: child.status,
            argv1: style(out.argv1),
            filename: style(out.filename),
            cwd: style(out.cwd),
          },
        };
      }
    );
  }

  return raw;
}
