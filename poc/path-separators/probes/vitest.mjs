// Probe: path separators in Vitest (repo root install, run programmatically via `vitest/node`).
//
// Builds a tiny fixture in ctx.workDir (own config file with a `transform`-recording plugin, one
// setup file, one test file). The setup and test files write what they see (testPath, task
// filepath, import.meta.*, __dirname/__filename) to JSON files; a custom reporter records the
// module ids Vitest reports. Then it re-runs with `root`, `setupFiles` and an absolute `include`
// given as forward-slash and (Windows only) backslash paths to see which forms Vitest accepts.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TEST_REL = 'tests/sep.probe.test.mjs';
const SETUP_REL = 'setup/sep.setup.mjs';

const CONFIG_SRC = `// Fixture config for the path-separator probe. Records ids seen by a transform hook.
export default {
  plugins: [
    {
      name: 'sep-probe-record-transform',
      transform(code, id) {
        if (id.includes('sep.probe.test') || id.includes('sep.setup')) {
          (globalThis.__sepProbeTransformIds ??= []).push(id);
        }
        return null;
      },
    },
  ],
  test: { pool: 'forks', fileParallelism: false, watch: false },
};
`;

const SETUP_SRC = `import { writeFileSync } from 'node:fs';
writeFileSync(
  process.env.SEP_PROBE_OUT + '.setup.json',
  JSON.stringify({
    setupRan: true,
    importMetaUrl: import.meta.url,
    importMetaFilename: import.meta.filename ?? null,
    importMetaDirname: import.meta.dirname ?? null,
    __filename: typeof __filename === 'string' ? __filename : null,
    __dirname: typeof __dirname === 'string' ? __dirname : null,
  })
);
`;

const TEST_SRC = `import { writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('records paths', ({ task }) => {
  writeFileSync(
    process.env.SEP_PROBE_OUT + '.test.json',
    JSON.stringify({
      testPath: expect.getState().testPath ?? null,
      taskFileFilepath: task.file?.filepath ?? null,
      importMetaUrl: import.meta.url,
      importMetaFilename: import.meta.filename ?? null,
      importMetaDirname: import.meta.dirname ?? null,
      __filename: typeof __filename === 'string' ? __filename : null,
      __dirname: typeof __dirname === 'string' ? __dirname : null,
    })
  );
  expect(1).toBe(1);
});
`;

export function versions(ctx) {
  return { vitest: ctx.packageVersion('vitest'), vite: ctx.packageVersion('vite') };
}

const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null);

export async function run(ctx) {
  const { startVitest } = await ctx.importFrom('vitest/node');
  const w = ctx.workDir;
  mkdirSync(path.join(w, 'tests'), { recursive: true });
  mkdirSync(path.join(w, 'setup'), { recursive: true });
  const configFile = path.join(w, 'vitest.config.mjs');
  writeFileSync(configFile, CONFIG_SRC);
  writeFileSync(path.join(w, SETUP_REL), SETUP_SRC);
  writeFileSync(path.join(w, TEST_REL), TEST_SRC);
  const testNative = path.join(w, TEST_REL);
  const setupNative = path.join(w, SETUP_REL);

  /** One Vitest run; returns everything observed. */
  async function runVitest(label, { root, setupFiles, include }) {
    const out = path.join(w, `out-${label}`);
    process.env.SEP_PROBE_OUT = out;
    globalThis.__sepProbeTransformIds = [];
    const reporter = {
      vitest: null,
      seen: { onTestRunEnd: [], stateFiles: [], resolved: null },
      onInit(vitest) {
        this.vitest = vitest;
      },
      onTestRunEnd(testModules) {
        this.seen.onTestRunEnd = testModules.map((m) => ({
          moduleId: m.moduleId,
          taskFilepath: m.task?.filepath ?? null,
          relativeModuleId: m.relativeModuleId,
          state: m.state(),
        }));
        this.seen.stateFiles = this.vitest.state.getFiles().map((f) => f.filepath);
        const cfg = this.vitest.config;
        this.seen.resolved = { root: cfg.root, include: cfg.include, setupFiles: cfg.setupFiles };
      },
    };
    const prevExit = process.exitCode;
    let error = null;
    try {
      await startVitest('test', [], {
        config: configFile,
        root,
        setupFiles,
        include,
        watch: false,
        reporters: [reporter],
        passWithNoTests: false,
      });
    } catch (e) {
      error = String(e?.stack ?? e);
    }
    const exitCode = process.exitCode;
    process.exitCode = prevExit;
    const test = readJson(`${out}.test.json`);
    const setup = readJson(`${out}.setup.json`);
    return {
      label,
      input: { root, setupFiles, include },
      exitCode: exitCode ?? 0,
      error,
      testRan: !!test,
      setupRan: !!setup?.setupRan,
      test,
      setup,
      reporter: reporter.seen,
      transformIds: [...globalThis.__sepProbeTransformIds],
    };
  }

  const raw = { workDir: w, testNative, setupNative, runs: {} };

  // ---- Baseline run: native paths everywhere (what most users write) ----
  let base;
  try {
    base = await runVitest('native', {
      root: w,
      setupFiles: [setupNative],
      include: [TEST_REL],
    });
    raw.runs.native = base;
  } catch (e) {
    ctx.claimError({
      id: 'vitest.baseline',
      claim: 'baseline run completes',
      kind: 'output',
      expected: 'ran',
      error: e,
    });
  }

  // ---- Claim 2: test-file paths exposed by Vitest are forward-slash ----
  const outputs = [
    [
      'vitest.expect.testPath',
      'expect.getState().testPath is /-separated',
      () => base.test?.testPath,
    ],
    [
      'vitest.task.file.filepath',
      'task.file.filepath inside a test is /-separated',
      () => base.test?.taskFileFilepath,
    ],
    [
      'vitest.reporter.moduleId',
      'reporter TestModule.moduleId is /-separated',
      () => base.reporter.onTestRunEnd[0]?.moduleId,
    ],
    [
      'vitest.reporter.task.filepath',
      'reporter TestModule.task.filepath is /-separated',
      () => base.reporter.onTestRunEnd[0]?.taskFilepath,
    ],
    [
      'vitest.state.files.filepath',
      'vitest.state.getFiles()[].filepath is /-separated',
      () => base.reporter.stateFiles[0],
    ],
    [
      'vitest.config.root',
      'resolved config.root is /-separated',
      () => base.reporter.resolved?.root,
    ],
    [
      'vitest.config.setupFiles',
      'resolved config.setupFiles[] are /-separated',
      () => base.reporter.resolved?.setupFiles?.[0],
    ],
    [
      'vitest.plugin.transform.id.test',
      'plugin transform id for the test file is /-separated',
      () => base.transformIds.find((id) => id.includes('sep.probe.test')),
    ],
    [
      'vitest.plugin.transform.id.setup',
      'plugin transform id for the setup file is /-separated',
      () => base.transformIds.find((id) => id.includes('sep.setup')),
    ],
  ];
  for (const [id, claim, get] of outputs) {
    try {
      const value = get();
      ctx.claim({
        id,
        claim,
        kind: 'output',
        expected: 'forward',
        observed: ctx.separatorStyle(value),
        notes: `raw: ${JSON.stringify(value)}`,
      });
    } catch (e) {
      ctx.claimError({ id, claim, kind: 'output', expected: 'forward', error: e });
    }
  }

  // ---- Claim 3: import.meta.* and CJS globals inside the test file ----
  // Vite's module runner (createDefaultImportMeta) converts filename/dirname to Windows paths;
  // Vitest's evaluator sets __filename/__dirname from the same values. url is a file:// URL.
  const native = ctx.isWindows ? 'backslash' : 'forward';
  const metas = [
    [
      'vitest.importMeta.url',
      'import.meta.url in a test is a file:// URL with / separators',
      'test',
      'importMetaUrl',
      'forward',
    ],
    [
      'vitest.importMeta.filename',
      'import.meta.filename in a test is a native path',
      'test',
      'importMetaFilename',
      native,
    ],
    [
      'vitest.importMeta.dirname',
      'import.meta.dirname in a test is a native path',
      'test',
      'importMetaDirname',
      native,
    ],
    [
      'vitest.cjs.__filename',
      '__filename (injected by Vitest) in an ESM test is a native path',
      'test',
      '__filename',
      native,
    ],
    [
      'vitest.cjs.__dirname',
      '__dirname (injected by Vitest) in an ESM test is a native path',
      'test',
      '__dirname',
      native,
    ],
    [
      'vitest.setup.importMeta.filename',
      'import.meta.filename in a setup file is a native path',
      'setup',
      'importMetaFilename',
      native,
    ],
  ];
  for (const [id, claim, where, key, expected] of metas) {
    try {
      const value = base[where]?.[key];
      const extra = key === 'importMetaUrl' ? { urlScheme: String(value).slice(0, 8) } : {};
      ctx.claim({
        id,
        claim,
        kind: 'output',
        expected,
        observed: ctx.separatorStyle(value),
        notes: `raw: ${JSON.stringify(value)}${extra.urlScheme ? `; starts with ${extra.urlScheme}` : ''}`,
      });
    } catch (e) {
      ctx.claimError({ id, claim, kind: 'output', expected, error: e });
    }
  }

  // ---- Claim 4: inputs accepted in both forms ----
  // Every variant changes one option; the others use forward-slash forms. "accepted" means the
  // setup file ran and the test file ran (exit code 0).
  const fwd = ctx.toForward;
  const forms = {
    forward: (p) => fwd(p),
    backslash: (p) => (ctx.isWindows ? ctx.toBackslash(p) : null),
  };
  const variants = [
    ['root', (f) => ({ root: f(w), setupFiles: [fwd(setupNative)], include: [TEST_REL] })],
    ['setupFiles', (f) => ({ root: fwd(w), setupFiles: [f(setupNative)], include: [TEST_REL] })],
    [
      'include.absolute',
      (f) => ({
        root: fwd(w),
        setupFiles: [fwd(setupNative)],
        include: [f(path.join(w, 'tests', '*.probe.test.mjs'))],
      }),
    ],
  ];
  // Predictions: root and setupFiles are resolved through path.resolve / pathe.normalize, so both
  // forms work. include is a tinyglobby pattern, where `\` is an escape character; Vitest docs
  // describe include as glob patterns, so an absolute backslash pattern is predicted to match
  // nothing on Windows.
  const predicted = {
    root: { forward: 'accepted', backslash: 'accepted' },
    setupFiles: { forward: 'accepted', backslash: 'accepted' },
    'include.absolute': { forward: 'accepted', backslash: 'rejected' },
  };
  for (const [option, build] of variants) {
    for (const [form, f] of Object.entries(forms)) {
      const id = `vitest.input.${option}.${form}`;
      const claim = `Vitest accepts an absolute ${form} path for \`${option}\``;
      if (form === 'backslash' && !ctx.isWindows) {
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
        const r = await runVitest(`${option}-${form}`, build(f));
        raw.runs[`${option}-${form}`] = r;
        const ok = r.testRan && r.setupRan && r.exitCode === 0;
        ctx.claim({
          id,
          claim,
          kind: 'input',
          expected: predicted[option][form],
          observed: ok ? 'accepted' : 'rejected',
          notes: `testRan=${r.testRan} setupRan=${r.setupRan} exitCode=${r.exitCode}; input=${JSON.stringify(r.input)}; resolved=${JSON.stringify(r.reporter.resolved)}; testPath=${JSON.stringify(r.test?.testPath)}`,
        });
      } catch (e) {
        ctx.claimError({ id, claim, kind: 'input', expected: predicted[option][form], error: e });
      }
    }
  }

  delete process.env.SEP_PROBE_OUT;
  return raw;
}
