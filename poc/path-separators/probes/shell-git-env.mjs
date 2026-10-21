// Probe: path separators in shell commands, child processes, git pathspecs, PATH and env vars.
//
// Models the repo code that stays on node:path because paths end up in shell strings
// (scripts/run-registry.ts `cd "<dir>" && ...`, generate-rule.ts `code "<file>"`), in git
// pathspecs (code/core/src/telemetry/get-application-file-count.ts builds
// `${basePath}${sep}*page*.tsx`), or in PATH lookups (code/core/src/common/utils/command.ts
// splits PATH with node:path `delimiter`). Checks:
//   1. exec with the platform shell (cmd.exe on Windows): node/cd/type/dir/copy/if exist/.cmd with `/` paths
//   2. spawnSync (no shell) of git/node with `/` paths in args, cwd and the command itself
//   3. which forms of `git ls-files -- <pathspec>` match, and what git prints
//   4. PATH delimiter vs pathe 1.1.2 (code/core) and 2.0.3 (root) `delimiter`
//   5. env vars holding paths round-trip verbatim through a child process
import { exec, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const SKIP = 'skipped-on-posix';
const OK = 'ok';
const FAIL = 'fail';

export function versions(ctx) {
  return {
    'pathe (root)': patheVersion(ctx, '.'),
    'pathe (code/core)': patheVersion(ctx, 'code/core'),
    git: gitVersion(),
    shell: ctx.isWindows ? process.env.ComSpec || 'cmd.exe' : '/bin/sh',
  };
}

function gitVersion() {
  const r = spawnSync('git', ['--version'], { encoding: 'utf8' });
  return r.error ? null : r.stdout.trim();
}

/** Runs `command` through child_process.exec (always uses a shell) and never throws. */
async function sh(command, options = {}) {
  try {
    const { stdout, stderr } = await execAsync(command, { encoding: 'utf8', ...options });
    return { command, ok: true, code: 0, stdout, stderr };
  } catch (e) {
    return {
      command,
      ok: false,
      code: e.code ?? null,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? String(e),
    };
  }
}

/** Runs a file directly (no shell) and never throws. */
function runFile(file, args, options = {}) {
  const r = spawnSync(file, args, { encoding: 'utf8', ...options });
  return {
    file,
    args,
    ok: !r.error && r.status === 0,
    code: r.status,
    error: r.error ? String(r.error) : undefined,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

// pathe's `exports` hides package.json, so resolve its CJS entry and use the sibling ESM build.
const patheDistDir = (ctx, workspace) => path.dirname(ctx.requireFrom(workspace).resolve('pathe'));
const patheVersion = (ctx, workspace) => {
  try {
    return JSON.parse(
      readFileSync(path.join(patheDistDir(ctx, workspace), '..', 'package.json'), 'utf8')
    ).version;
  } catch {
    return null;
  }
};
async function importPathe(ctx, workspace) {
  return import(pathToFileURL(path.join(patheDistDir(ctx, workspace), 'index.mjs')).href);
}

const lines = (s) => s.split(/\r?\n/).filter(Boolean);
const isDriveLetterFragment = (entry) => /^[A-Za-z]$/.test(entry);

export async function run(ctx) {
  const raw = {};
  const { isWindows, toForward } = ctx;
  const posixSkip = (id, claim, kind = 'input') =>
    ctx.claim({
      id,
      claim,
      kind,
      expected: SKIP,
      observed: SKIP,
      notes: 'cmd.exe-specific; nothing to test on POSIX',
    });

  // ---- Fixture -------------------------------------------------------------------------------
  const filesDir = path.join(ctx.workDir, 'files');
  mkdirSync(filesDir, { recursive: true });
  const helloFile = path.join(filesDir, 'hello.txt');
  writeFileSync(helloFile, 'hello-from-file\n');
  const script = path.join(filesDir, 'script.mjs');
  writeFileSync(script, "process.stdout.write('script-ran ' + JSON.stringify(process.argv[1]));\n");
  const batch = path.join(filesDir, 'hello.cmd');
  writeFileSync(batch, '@echo cmd-ran\r\n');
  const fwd = {
    filesDir: toForward(filesDir),
    helloFile: toForward(helloFile),
    script: toForward(script),
    batch: toForward(batch),
  };
  raw.fixture = {
    workDir: ctx.workDir,
    native: { filesDir, helloFile, script, batch },
    forward: fwd,
  };
  raw.shell = {};

  // ---- 1. Shell commands (exec => cmd.exe /d /s /c on Windows, /bin/sh -c on POSIX) -----------
  const shellStep = async (id, claim, command, { expected = OK, check, options, notes } = {}) => {
    try {
      const r = await sh(command, options);
      raw.shell[id] = r;
      const outcome = check ? (check(r) ? OK : FAIL) : r.ok ? OK : FAIL;
      ctx.claim({
        id,
        claim,
        kind: 'input',
        expected,
        observed: outcome,
        notes: notes ?? `raw.shell["${id}"] has stdout/stderr`,
      });
    } catch (error) {
      ctx.claimError({ id, claim, kind: 'input', expected, error });
    }
  };

  await shellStep(
    'shell.node-script.forward',
    'shell: node "<script in / form>" runs the script',
    `node "${fwd.script}"`,
    {
      check: (r) => r.ok && r.stdout.includes('script-ran'),
    }
  );
  await shellStep(
    'shell.node-script.native',
    'shell: node "<script in native form>" runs the script (baseline)',
    `node "${script}"`,
    {
      check: (r) => r.ok && r.stdout.includes('script-ran'),
    }
  );
  // Same shape as scripts/run-registry.ts: cd "<dir>" && <command>
  await shellStep(
    'shell.cd-and-node.forward',
    'shell: cd "<dir in / form>" && node -e ... runs in that dir',
    `cd "${fwd.filesDir}" && node -e "process.stdout.write(process.cwd())"`,
    {
      check: (r) => r.ok && path.resolve(r.stdout.trim()) === path.resolve(filesDir),
      notes:
        'process.cwd() of the child is in raw.shell[...].stdout (native form expected). cmd `cd` without /d does not switch drives; fixture is on the repo drive.',
    }
  );

  if (isWindows) {
    // cmd builtins. Prediction: quoted `/` paths work, unquoted `/` segments are parsed as switches.
    await shellStep(
      'shell.cmd.type.quoted-forward',
      'cmd: type "<file in / form>" prints the file',
      `type "${fwd.helloFile}"`,
      {
        check: (r) => r.ok && r.stdout.includes('hello-from-file'),
      }
    );
    await shellStep(
      'shell.cmd.type.unquoted-forward',
      'cmd: type <file in / form> (unquoted) prints the file',
      `type ${fwd.helloFile}`,
      {
        expected: FAIL,
        check: (r) => r.ok && r.stdout.includes('hello-from-file'),
      }
    );
    await shellStep(
      'shell.cmd.dir.quoted-forward',
      'cmd: dir /b "<dir in / form>" lists the dir',
      `dir /b "${fwd.filesDir}"`,
      {
        check: (r) => r.ok && r.stdout.includes('hello.txt'),
      }
    );
    await shellStep(
      'shell.cmd.dir.unquoted-forward',
      'cmd: dir /b <dir in / form> (unquoted) lists the dir',
      `dir /b ${fwd.filesDir}`,
      {
        expected: FAIL,
        check: (r) => r.ok && r.stdout.includes('hello.txt'),
      }
    );
    const copyQuoted = path.join(filesDir, 'copy-quoted.txt');
    await shellStep(
      'shell.cmd.copy.quoted-forward',
      'cmd: copy /y "<src in / form>" "<dst in / form>" copies',
      `copy /y "${fwd.helloFile}" "${toForward(copyQuoted)}"`,
      { check: (r) => r.ok && existsSync(copyQuoted) }
    );
    const copyUnquoted = path.join(filesDir, 'copy-unquoted.txt');
    await shellStep(
      'shell.cmd.copy.unquoted-forward',
      'cmd: copy /y <src in / form> <dst in / form> (unquoted) copies',
      `copy /y ${fwd.helloFile} ${toForward(copyUnquoted)}`,
      { expected: FAIL, check: (r) => r.ok && existsSync(copyUnquoted) }
    );
    await shellStep(
      'shell.cmd.if-exist.quoted-forward',
      'cmd: if exist "<file in / form>" is true',
      `if exist "${fwd.helloFile}" (echo yes) else (echo no)`,
      { check: (r) => r.ok && r.stdout.trim() === 'yes' }
    );
    await shellStep(
      'shell.cmd.batch.quoted-absolute-forward',
      'cmd: "<abs .cmd in / form>" runs the batch file',
      `"${fwd.batch}"`,
      {
        check: (r) => r.ok && r.stdout.includes('cmd-ran'),
      }
    );
    await shellStep(
      'shell.cmd.batch.unquoted-relative-forward',
      'cmd: files/hello.cmd (relative, unquoted, / form) runs the batch file',
      'files/hello.cmd',
      {
        expected: FAIL,
        options: { cwd: ctx.workDir },
        check: (r) => r.ok && r.stdout.includes('cmd-ran'),
        notes: "prediction: cmd splits at '/' and looks for a command named 'files'",
      }
    );
    await shellStep(
      'shell.cmd.batch.unquoted-relative-backslash',
      'cmd: files\\hello.cmd (relative, native form) runs the batch file (baseline)',
      'files\\hello.cmd',
      { options: { cwd: ctx.workDir }, check: (r) => r.ok && r.stdout.includes('cmd-ran') }
    );
  } else {
    await shellStep(
      'shell.cmd.type.quoted-forward',
      'sh: cat "<file>" prints the file (POSIX stand-in for type)',
      `cat "${fwd.helloFile}"`,
      {
        check: (r) => r.ok && r.stdout.includes('hello-from-file'),
      }
    );
    posixSkip(
      'shell.cmd.type.unquoted-forward',
      'cmd: type <file in / form> (unquoted) prints the file'
    );
    await shellStep(
      'shell.cmd.dir.quoted-forward',
      'sh: ls "<dir>" lists the dir (POSIX stand-in for dir)',
      `ls "${fwd.filesDir}"`,
      {
        check: (r) => r.ok && r.stdout.includes('hello.txt'),
      }
    );
    posixSkip(
      'shell.cmd.dir.unquoted-forward',
      'cmd: dir /b <dir in / form> (unquoted) lists the dir'
    );
    const copyQuoted = path.join(filesDir, 'copy-quoted.txt');
    await shellStep(
      'shell.cmd.copy.quoted-forward',
      'sh: cp "<src>" "<dst>" copies (POSIX stand-in for copy)',
      `cp "${fwd.helloFile}" "${copyQuoted}"`,
      {
        check: (r) => r.ok && existsSync(copyQuoted),
      }
    );
    posixSkip(
      'shell.cmd.copy.unquoted-forward',
      'cmd: copy /y <src in / form> <dst in / form> (unquoted) copies'
    );
    await shellStep(
      'shell.cmd.if-exist.quoted-forward',
      'sh: [ -e "<file>" ] is true (POSIX stand-in for if exist)',
      `[ -e "${fwd.helloFile}" ] && echo yes || echo no`,
      {
        check: (r) => r.ok && r.stdout.trim() === 'yes',
      }
    );
    posixSkip(
      'shell.cmd.batch.quoted-absolute-forward',
      'cmd: "<abs .cmd in / form>" runs the batch file'
    );
    posixSkip(
      'shell.cmd.batch.unquoted-relative-forward',
      'cmd: files/hello.cmd (relative, unquoted, / form) runs the batch file'
    );
    posixSkip(
      'shell.cmd.batch.unquoted-relative-backslash',
      'cmd: files\\hello.cmd (relative, native form) runs the batch file (baseline)'
    );
  }

  // ---- 2. spawnSync without a shell ------------------------------------------------------------
  raw.spawn = {};
  try {
    const r = runFile(toForward(process.execPath), ['-e', "process.stdout.write('exe-ok')"]);
    raw.spawn.nodeExeForward = r;
    ctx.claim({
      id: 'spawn.command.forward',
      claim: 'spawnSync accepts the executable itself in / form (node at C:/.../node.exe)',
      kind: 'input',
      expected: OK,
      observed: r.ok && r.stdout === 'exe-ok' ? OK : FAIL,
      notes: 'raw.spawn.nodeExeForward',
    });
  } catch (error) {
    ctx.claimError({
      id: 'spawn.command.forward',
      claim: 'spawnSync accepts the executable in / form',
      kind: 'input',
      expected: OK,
      error,
    });
  }
  try {
    const r = runFile(process.execPath, [fwd.script], { cwd: fwd.filesDir });
    raw.spawn.nodeScriptForward = r;
    ctx.claim({
      id: 'spawn.node.args-and-cwd.forward',
      claim: 'spawnSync(node, ["<script in / form>"], { cwd: "<dir in / form>" }) runs',
      kind: 'input',
      expected: OK,
      observed: r.ok && r.stdout.includes('script-ran') ? OK : FAIL,
      notes: 'raw.spawn.nodeScriptForward.stdout shows process.argv[1] as Node normalised it',
    });
  } catch (error) {
    ctx.claimError({
      id: 'spawn.node.args-and-cwd.forward',
      claim: 'spawnSync node with / script and cwd',
      kind: 'input',
      expected: OK,
      error,
    });
  }

  // ---- git fixture -------------------------------------------------------------------------------
  const git = gitVersion();
  raw.git = { version: git };
  ctx.claim({
    id: 'git.available',
    claim: 'git is on PATH (git claims below need it)',
    kind: 'input',
    expected: true,
    observed: Boolean(git),
  });

  if (git) {
    const repo = path.join(ctx.workDir, 'repo');
    const fwdRepo = toForward(repo);
    raw.git.repo = { native: repo, forward: fwdRepo };
    const tracked = [
      'src/HomePage.tsx',
      'src/util.ts',
      'src/nested/LoginScreen.tsx',
      'other/page.ts',
    ];
    try {
      for (const file of tracked) {
        mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
        writeFileSync(path.join(repo, file), 'export {};\n');
      }
      const g = (...args) => runFile('git', ['-c', 'core.autocrlf=false', ...args], { cwd: repo });
      const steps = [
        g('-c', 'init.defaultBranch=main', 'init', '-q'),
        g('add', '-A'),
        g(
          '-c',
          'user.email=probe@example.com',
          '-c',
          'user.name=probe',
          '-c',
          'commit.gpgsign=false',
          'commit',
          '-q',
          '-m',
          'init'
        ),
      ];
      raw.git.setup = steps;
      const failed = steps.find((s) => !s.ok);
      if (failed) throw new Error(`git setup failed: ${JSON.stringify(failed)}`);
    } catch (error) {
      ctx.claimError({
        id: 'git.fixture',
        claim: 'git fixture repo can be created',
        kind: 'input',
        expected: OK,
        error,
      });
    }

    // 2b. git -C <dir in / form> (no shell)
    for (const [variant, dir] of [
      ['forward', fwdRepo],
      ['native', repo],
    ]) {
      const id = `spawn.git-C.${variant}`;
      const claim = `spawnSync('git', ['-C', <repo in ${variant} form>, 'rev-parse', '--show-toplevel']) works`;
      if (variant === 'native' && !isWindows) {
        ctx.claim({
          id,
          claim,
          kind: 'input',
          expected: SKIP,
          observed: SKIP,
          notes: 'native == forward on POSIX',
        });
        continue;
      }
      try {
        const r = runFile('git', ['-C', dir, 'rev-parse', '--show-toplevel']);
        raw.spawn[id] = r;
        const top = r.stdout.trim();
        ctx.claim({
          id,
          claim,
          kind: 'input',
          expected: OK,
          observed: r.ok && path.resolve(top) === path.resolve(repo) ? OK : FAIL,
          notes: `raw.spawn["${id}"]`,
        });
      } catch (error) {
        ctx.claimError({ id, claim, kind: 'input', expected: OK, error });
      }
    }
    try {
      const r = runFile('git', ['rev-parse', '--show-toplevel'], { cwd: repo });
      raw.git.showToplevel = r.stdout.trim();
      ctx.claim({
        id: 'git.output.show-toplevel',
        claim: 'git prints absolute paths with / (C:/... on Windows)',
        kind: 'output',
        expected: 'forward',
        observed: ctx.separatorStyle(raw.git.showToplevel),
        notes: 'raw.git.showToplevel',
      });
    } catch (error) {
      ctx.claimError({
        id: 'git.output.show-toplevel',
        claim: 'git prints / paths',
        kind: 'output',
        expected: 'forward',
        error,
      });
    }

    // ---- 3. git pathspecs ------------------------------------------------------------------------
    raw.git.lsFiles = {};
    const lsFiles = (
      id,
      claim,
      pathspec,
      expectedFiles,
      { windowsOnly = false, cwd = repo, notes } = {}
    ) => {
      if (windowsOnly && !isWindows) {
        ctx.claim({
          id,
          claim,
          kind: 'input',
          expected: SKIP,
          observed: SKIP,
          notes: 'backslash is not a separator on POSIX',
        });
        return;
      }
      try {
        const r = runFile('git', ['ls-files', '--', pathspec], { cwd });
        const out = lines(r.stdout);
        raw.git.lsFiles[id] = { pathspec, cwd, ok: r.ok, stdout: out, stderr: r.stderr };
        ctx.claim({
          id,
          claim,
          kind: 'input',
          expected: expectedFiles,
          observed: r.ok ? [...out].sort() : { error: r.stderr.trim() },
          notes: notes ?? `pathspec ${JSON.stringify(pathspec)}; raw.git.lsFiles["${id}"]`,
        });
      } catch (error) {
        ctx.claimError({ id, claim, kind: 'input', expected: expectedFiles, error });
      }
    };
    const srcAll = ['src/HomePage.tsx', 'src/nested/LoginScreen.tsx', 'src/util.ts'];
    lsFiles(
      'git.pathspec.relative-dir.forward',
      'git ls-files -- src/ matches files under src',
      'src/',
      srcAll
    );
    lsFiles(
      'git.pathspec.relative-dir.backslash',
      'git ls-files -- src\\ matches files under src (Git for Windows)',
      'src\\',
      srcAll,
      {
        windowsOnly: true,
      }
    );
    lsFiles(
      'git.pathspec.absolute-dir.forward',
      'git ls-files -- <abs repo>/src/ (/ form) matches',
      `${fwdRepo}/src/`,
      srcAll
    );
    lsFiles(
      'git.pathspec.absolute-dir.native',
      'git ls-files -- <abs repo>\\src\\ (native form) matches',
      `${repo}\\src\\`,
      srcAll,
      {
        windowsOnly: true,
      }
    );
    lsFiles(
      'git.pathspec.relative-nested.backslash',
      'git ls-files -- src\\nested\\LoginScreen.tsx matches',
      'src\\nested\\LoginScreen.tsx',
      ['src/nested/LoginScreen.tsx'],
      {
        windowsOnly: true,
      }
    );
    // Output form when run from a subdirectory: paths are relative to cwd, still with /.
    lsFiles(
      'git.output.ls-files-from-subdir',
      'git ls-files from repo/src prints cwd-relative paths with /',
      '.',
      ['HomePage.tsx', 'nested/LoginScreen.tsx', 'util.ts'],
      {
        cwd: path.join(repo, 'src'),
      }
    );

    // Telemetry shape: `${basePath}${sep}*${match}*.${ext}` for page/Page/screen/Screen x js/jsx/ts/tsx.
    // Without :(glob) magic, `*` also matches `/`, so src/nested/LoginScreen.tsx counts too.
    const telemetryGlobs = (base, sep) =>
      ['page', 'Page', 'screen', 'Screen'].flatMap((m) =>
        ['js', 'jsx', 'ts', 'tsx'].map((e) => `${base}${sep}*${m}*.${e}`)
      );
    const telemetryExpected = ['src/HomePage.tsx', 'src/nested/LoginScreen.tsx'];
    for (const [variant, base, sep] of [
      ['forward', `${fwdRepo}/src`, '/'],
      ['native', path.join(repo, 'src'), path.sep],
    ]) {
      const id = `git.pathspec.telemetry-globs.${variant}`;
      const claim = `get-application-file-count globs with ${variant} basePath + sep (e.g. ${variant === 'native' ? 'C:\\\\repo\\\\src\\\\*page*.tsx' : 'C:/repo/src/*page*.tsx'}) match`;
      if (variant === 'native' && !isWindows) {
        ctx.claim({
          id,
          claim,
          kind: 'input',
          expected: SKIP,
          observed: SKIP,
          notes: 'native == forward on POSIX',
        });
        continue;
      }
      try {
        const globs = telemetryGlobs(base, sep);
        const r = runFile('git', ['ls-files', '--', ...globs], { cwd: repo });
        const out = lines(r.stdout);
        raw.git.lsFiles[id] = { firstGlob: globs[0], ok: r.ok, stdout: out, stderr: r.stderr };
        ctx.claim({
          id,
          claim,
          kind: 'input',
          expected: telemetryExpected,
          observed: r.ok ? [...out].sort() : { error: r.stderr.trim() },
          notes: `on Windows the native glob contains "\\*", which is a glob escape unless git turns "\\" into "/" first; raw.git.lsFiles["${id}"]`,
        });
      } catch (error) {
        ctx.claimError({ id, claim, kind: 'input', expected: telemetryExpected, error });
      }
    }
  }

  // ---- 4. PATH delimiter vs pathe ---------------------------------------------------------------
  raw.delimiter = {};
  try {
    const pathe2 = await importPathe(ctx, '.');
    const pathe1 = await importPathe(ctx, 'code/core');
    const envPath = process.env.PATH ?? process.env.Path ?? '';
    const sampleWindowsPath = 'C:\\Windows\\system32;C:\\Program Files\\nodejs;D:\\tools\\bin';
    const split = (value, d) => value.split(d);
    raw.delimiter = {
      nodePath: path.delimiter,
      nodeWin32: path.win32.delimiter,
      pathe1: pathe1.delimiter,
      pathe1Default: pathe1.default.delimiter,
      pathe2Named: pathe2.delimiter,
      pathe2Default: pathe2.default.delimiter,
      pathe2Win32: pathe2.win32.delimiter,
      envPathHead: envPath.slice(0, 300),
      sampleWindowsPath,
      sampleSplitPathe1: split(sampleWindowsPath, pathe1.delimiter),
      sampleSplitNodeWin32: split(sampleWindowsPath, path.win32.delimiter),
    };
    ctx.claim({
      id: 'path.env.delimiter',
      claim: 'node:path delimiter (what process.env.PATH uses) is ";" on Windows, ":" on POSIX',
      kind: 'output',
      expected: isWindows ? ';' : ':',
      observed: path.delimiter,
    });
    ctx.claim({
      id: 'path.env.contains-drive-letters',
      claim: 'process.env.PATH entries carry drive letters (X:\\...) on Windows',
      kind: 'output',
      expected: isWindows,
      observed: envPath.split(path.delimiter).some((e) => /^[A-Za-z]:[\\/]/.test(e)),
      notes: 'raw.delimiter.envPathHead',
    });
    ctx.claim({
      id: 'pathe1.delimiter',
      claim: 'pathe@1.1.2 (code/core) delimiter is always ":"',
      kind: 'output',
      expected: ':',
      observed: pathe1.delimiter,
    });
    ctx.claim({
      id: 'pathe2.delimiter.named',
      claim: 'pathe@2.0.3 (root) named export `delimiter` is platform-dependent (";" on Windows)',
      kind: 'output',
      expected: isWindows ? ';' : ':',
      observed: pathe2.delimiter,
    });
    ctx.claim({
      id: 'pathe2.delimiter.default-export',
      claim: 'pathe@2.0.3 default export (posix proxy) `.delimiter` is always ":"',
      kind: 'output',
      expected: ':',
      observed: pathe2.default.delimiter,
    });
    // Real PATH split with each delimiter: does it produce bare drive-letter fragments ("C")?
    for (const [id, d, broken] of [
      ['path.env.split.pathe1', pathe1.delimiter, isWindows],
      ['path.env.split.pathe2-default', pathe2.default.delimiter, isWindows],
      ['path.env.split.pathe2-named', pathe2.delimiter, false],
      ['path.env.split.node', path.delimiter, false],
    ]) {
      const parts = split(envPath, d);
      raw.delimiter[id] = parts.slice(0, 8);
      ctx.claim({
        id,
        claim: `splitting process.env.PATH with ${JSON.stringify(d)} ${broken ? 'breaks' : 'keeps'} drive letters`,
        kind: 'input',
        expected: broken ? 'broken' : 'intact',
        observed: parts.some(isDriveLetterFragment) ? 'broken' : 'intact',
        notes: `first entries in raw.delimiter["${id}"]`,
      });
    }
    ctx.claim({
      id: 'path.sample-windows-path.split.pathe1',
      claim:
        'splitting a Windows PATH string with pathe@1 delimiter yields drive-letter fragments (any platform)',
      kind: 'input',
      expected: ['C', '\\Windows\\system32;C', '\\Program Files\\nodejs;D', '\\tools\\bin'],
      observed: raw.delimiter.sampleSplitPathe1,
    });
  } catch (error) {
    ctx.claimError({
      id: 'path.delimiter',
      claim: 'PATH delimiter checks',
      kind: 'output',
      expected: null,
      error,
    });
  }

  // ---- 5. env var round-trip ------------------------------------------------------------------------
  raw.env = {};
  const envValues = {
    forward: fwd.filesDir,
    native: filesDir,
    mixed: `${fwd.filesDir}\\sub/dir`,
  };
  for (const [variant, value] of Object.entries(envValues)) {
    const id = `env.roundtrip.${variant}`;
    try {
      const r = runFile(
        process.execPath,
        ['-e', 'process.stdout.write(process.env.PROBE_PATH_VAR)'],
        {
          env: { ...process.env, PROBE_PATH_VAR: value },
        }
      );
      raw.env[id] = { sent: value, received: r.stdout, stderr: r.stderr };
      ctx.claim({
        id,
        claim: `env var holding a ${variant}-form path reaches a child Node process verbatim`,
        kind: 'input',
        expected: value,
        observed: r.stdout,
      });
    } catch (error) {
      ctx.claimError({ id, claim: 'env var round-trip', kind: 'input', expected: value, error });
    }
  }
  try {
    const value = envValues.forward;
    const r = await sh(isWindows ? 'echo %PROBE_PATH_VAR%' : 'echo "$PROBE_PATH_VAR"', {
      env: { ...process.env, PROBE_PATH_VAR: value },
    });
    raw.env['env.roundtrip.shell-expansion'] = r;
    ctx.claim({
      id: 'env.roundtrip.shell-expansion',
      claim: 'a / form path in an env var expands verbatim in the shell (%X% / $X)',
      kind: 'input',
      expected: value,
      observed: r.stdout.trim(),
    });
  } catch (error) {
    ctx.claimError({
      id: 'env.roundtrip.shell-expansion',
      claim: 'env var shell expansion',
      kind: 'input',
      expected: envValues.forward,
      error,
    });
  }

  return raw;
}
