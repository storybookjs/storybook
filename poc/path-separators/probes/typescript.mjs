// Probe: path separators in the TypeScript compiler API (the repo's root `typescript`).
//
// Models code/frameworks/svelte-vite/src/plugins/generateDocgen.ts, which keeps node:path because it
// "matches TypeScript host file names with path.sep": it wraps ts.createCompilerHost() and tests
// `fileName.endsWith(path.sep + 'package.json')` in readFile/fileExists and
// `fileName.split(path.sep)` for a `node_modules` segment in getSourceFile.
//
// Checks: (1) which APIs return `/`-normalized names and which return native ones, (2) that native
// root names are accepted and what format the host callbacks receive, (3) ts.sys cwd/executing path.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function versions(ctx) {
  return { typescript: ctx.packageVersion('typescript') };
}

const SKIP = 'skipped-on-posix';

/** Collapses a list of strings to the sorted set of separator styles it contains. */
function styles(ctx, values) {
  return [...new Set(values.map((v) => ctx.separatorStyle(v)))].sort();
}

function writeFixture(dir) {
  const files = {
    'tsconfig.json': JSON.stringify(
      {
        compilerOptions: {
          target: 'es2020',
          lib: ['es2020'],
          module: 'esnext',
          moduleResolution: 'bundler',
          strict: true,
          noEmit: true,
          types: [],
        },
        include: ['src'],
      },
      null,
      2
    ),
    'src/a.ts': [
      "import { b } from './b';",
      "import type { Dep } from 'dep';",
      'export const a: number = b;',
      'export const dep: Dep = { ok: true };',
      '// Deliberate type error so there is a diagnostic with a file.',
      'export const broken: string = 1;',
      '',
    ].join('\n'),
    'src/b.ts': 'export const b = 1;\n',
    'node_modules/dep/package.json': JSON.stringify({
      name: 'dep',
      version: '1.0.0',
      types: 'index.d.ts',
    }),
    'node_modules/dep/index.d.ts': 'export interface Dep { ok: boolean }\n',
  };
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(dir, ...rel.split('/'));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
}

/** Wraps a compiler host and records the file names TypeScript passes to each callback. */
function recordingHost(ts, options) {
  const base = ts.createCompilerHost(options);
  const calls = {
    fileExists: [],
    readFile: [],
    getSourceFile: [],
    directoryExists: [],
    realpath: [],
  };
  const host = {
    ...base,
    fileExists(f) {
      calls.fileExists.push(f);
      return base.fileExists(f);
    },
    readFile(f) {
      calls.readFile.push(f);
      return base.readFile(f);
    },
    getSourceFile(f, ...rest) {
      calls.getSourceFile.push(f);
      return base.getSourceFile(f, ...rest);
    },
    directoryExists(f) {
      calls.directoryExists.push(f);
      return base.directoryExists(f);
    },
    realpath: base.realpath
      ? (f) => {
          calls.realpath.push(f);
          return base.realpath(f);
        }
      : undefined,
  };
  return { host, calls };
}

/** Classifies how generateDocgen's `path.sep` tests fare against the names TS handed the host. */
function sepMatch(names, test) {
  if (names.length === 0) return 'no-calls';
  const hits = names.filter(test).length;
  if (hits === names.length) return 'all-match';
  return hits === 0 ? 'none-match' : 'some-match';
}

export async function run(ctx) {
  const ts = ctx.requireFrom()('typescript');
  const { workDir, isWindows } = ctx;
  writeFixture(workDir);
  const raw = { workDir };

  const nativeA = path.join(workDir, 'src', 'a.ts');
  const nativeB = path.join(workDir, 'src', 'b.ts');
  const fwd = ctx.toForward;
  const fwdExpected = 'forward';
  const nativeExpected = isWindows ? 'backslash' : 'forward';

  // ---- tsconfig: findConfigFile + parseJsonConfigFileContent (what generateDocgen's loadConfig does)
  let options = {};
  try {
    const configPath = ts.findConfigFile(workDir, ts.sys.fileExists);
    raw.findConfigFile = configPath;
    ctx.claim({
      id: 'typescript.findConfigFile.output',
      claim: 'ts.findConfigFile(nativeDir) returns a `/`-separated path',
      kind: 'output',
      expected: fwdExpected,
      observed: ctx.separatorStyle(configPath),
      notes: 'raw.findConfigFile; generateDocgen then calls path.dirname() on it',
    });
    const parsed = ts.parseJsonConfigFileContent(
      ts.readConfigFile(configPath, ts.sys.readFile).config,
      ts.sys,
      workDir, // native basePath on purpose
      undefined,
      configPath
    );
    options = parsed.options;
    raw.parseJsonConfigFileContent = {
      basePath: workDir,
      fileNames: parsed.fileNames,
      errors: parsed.errors.length,
    };
    ctx.claim({
      id: 'typescript.parseJsonConfigFileContent.fileNames',
      claim: 'parseJsonConfigFileContent(..., nativeBasePath).fileNames are `/`-separated',
      kind: 'output',
      expected: [fwdExpected],
      observed: styles(ctx, parsed.fileNames),
      notes: 'raw.parseJsonConfigFileContent.fileNames',
    });
  } catch (error) {
    ctx.claimError({
      id: 'typescript.parseJsonConfigFileContent.fileNames',
      claim: 'tsconfig parsing',
      kind: 'output',
      expected: [fwdExpected],
      error,
    });
  }

  // ---- createProgram with native roots and a recording host
  const programWith = (rootNames) => {
    const { host, calls } = recordingHost(ts, options);
    const program = ts.createProgram({ rootNames, options, host });
    return { program, calls };
  };
  const summarize = (program, calls, roots) => {
    const sourceFiles = program.getSourceFiles().map((sf) => sf.fileName);
    const diags = ts
      .getPreEmitDiagnostics(program)
      .filter((d) => d.file)
      .map((d) => d.file.fileName);
    return {
      roots,
      getRootFileNames: program.getRootFileNames(),
      sourceFiles,
      diagnosticFiles: [...new Set(diags)],
      foundA: Boolean(program.getSourceFile(roots[0])),
      foundAByForward: Boolean(program.getSourceFile(fwd(roots[0]))),
      calls: Object.fromEntries(
        Object.entries(calls).map(([k, v]) => [
          k,
          { count: v.length, styles: styles(ctx, v), sample: v.slice(0, 8) },
        ])
      ),
      rawCalls: calls,
    };
  };

  let nativeRun;
  try {
    const roots = [nativeA, nativeB];
    const { program, calls } = programWith(roots);
    nativeRun = summarize(program, calls, roots);
    const { rawCalls, ...printable } = nativeRun;
    raw.programNativeRoots = printable;

    ctx.claim({
      id: 'typescript.program.getSourceFiles.fileName',
      claim: 'program.getSourceFiles()[].fileName is `/`-separated even when roots were native',
      kind: 'output',
      expected: [fwdExpected],
      observed: styles(ctx, nativeRun.sourceFiles),
      notes: 'raw.programNativeRoots.sourceFiles',
    });
    ctx.claim({
      id: 'typescript.program.getRootFileNames',
      claim: 'program.getRootFileNames() returns rootNames as given (native, NOT normalized)',
      kind: 'output',
      expected: [nativeExpected],
      observed: styles(ctx, nativeRun.getRootFileNames),
      notes:
        'source: program.ts `getRootFileNames: () => rootNames`; contradicts the "always /" claim on Windows',
    });
    ctx.claim({
      id: 'typescript.diagnostics.file.fileName',
      claim: "diagnostics' file.fileName is `/`-separated",
      kind: 'output',
      expected: [fwdExpected],
      observed: styles(ctx, nativeRun.diagnosticFiles),
      check: (o) => o.length > 0 && o.every((s) => s === fwdExpected),
      notes: 'raw.programNativeRoots.diagnosticFiles (src/a.ts has a deliberate type error)',
    });
    ctx.claim({
      id: 'typescript.input.rootNames.native',
      claim:
        'createProgram accepts native root names; getSourceFile(native) and getSourceFile(forward) both find a.ts',
      kind: 'input',
      expected: { foundA: true, foundAByForward: true, aInProgram: true },
      observed: {
        foundA: nativeRun.foundA,
        foundAByForward: nativeRun.foundAByForward,
        aInProgram: nativeRun.sourceFiles.includes(fwd(nativeA)),
      },
    });
    for (const cb of ['getSourceFile', 'fileExists', 'readFile']) {
      ctx.claim({
        id: `typescript.host.${cb}.argFormat`,
        claim: `with native roots, host.${cb} is called with \`/\`-separated file names`,
        kind: 'output',
        expected: [fwdExpected],
        observed: nativeRun.calls[cb].styles,
        check: (o) => o.length > 0 && o.every((s) => s === fwdExpected),
        notes: `raw.programNativeRoots.calls.${cb}`,
      });
    }

    // generateDocgen's actual comparisons, against what the host really received.
    const pkgJsonNames = [...nativeRun.rawCalls.readFile, ...nativeRun.rawCalls.fileExists].filter(
      (f) => /[\\/]package\.json$/.test(f)
    );
    const nodeModulesSourceFiles = nativeRun.rawCalls.getSourceFile.filter((f) =>
      /[\\/]node_modules[\\/]/i.test(f)
    );
    raw.generateDocgenModel = { pathSep: path.sep, pkgJsonNames, nodeModulesSourceFiles };
    ctx.claim({
      id: 'typescript.generateDocgen.packageJson.pathSepMatch',
      claim:
        "generateDocgen's `fileName.endsWith(path.sep + 'package.json')` matches the package.json names TS passes to readFile/fileExists",
      kind: 'output',
      expected: isWindows ? 'none-match' : 'all-match',
      observed: sepMatch(pkgJsonNames, (f) => f.endsWith(path.sep + 'package.json')),
      notes:
        'Windows prediction: never matches, so the package.json cache is silently inert. raw.generateDocgenModel.pkgJsonNames',
    });
    ctx.claim({
      id: 'typescript.generateDocgen.nodeModules.pathSepMatch',
      claim:
        "generateDocgen's `fileName.split(path.sep).some(p => p === 'node_modules')` detects node_modules files passed to getSourceFile",
      kind: 'output',
      expected: isWindows ? 'none-match' : 'all-match',
      observed: sepMatch(nodeModulesSourceFiles, (f) =>
        f.split(path.sep).some((p) => p.toLowerCase() === 'node_modules')
      ),
      notes:
        'Windows prediction: never matches, so static caching of lib/node_modules files is off. raw.generateDocgenModel.nodeModulesSourceFiles',
    });
    ctx.claim({
      id: 'typescript.generateDocgen.slashLiteral.match',
      claim:
        "a `/` literal test (like generateDocgen's `fileName.includes('node_modules/svelte/elements.d.ts')`) matches SourceFile.fileName",
      kind: 'output',
      expected: true,
      observed: nativeRun.sourceFiles.some((f) => f.includes('node_modules/dep/index.d.ts')),
    });
  } catch (error) {
    ctx.claimError({
      id: 'typescript.program.nativeRoots',
      claim: 'createProgram with native roots',
      kind: 'input',
      expected: 'works',
      error,
    });
  }

  // Forward-slash roots: on Windows this is the non-native form; on POSIX it equals native.
  try {
    const roots = [fwd(nativeA), fwd(nativeB)];
    const { program, calls } = programWith(roots);
    const r = summarize(program, calls, roots);
    const { rawCalls, ...printable } = r;
    raw.programForwardRoots = printable;
    ctx.claim({
      id: 'typescript.input.rootNames.forward',
      claim:
        'createProgram accepts `/` root names (C:/... on Windows) with identical source file names',
      kind: 'input',
      expected: { foundA: true, sameSourceFiles: true, getSourceFileStyles: [fwdExpected] },
      observed: {
        foundA: r.foundA,
        sameSourceFiles: nativeRun
          ? JSON.stringify(r.sourceFiles) === JSON.stringify(nativeRun.sourceFiles)
          : null,
        getSourceFileStyles: r.calls.getSourceFile.styles,
      },
    });
  } catch (error) {
    ctx.claimError({
      id: 'typescript.input.rootNames.forward',
      claim: 'createProgram with / roots',
      kind: 'input',
      expected: 'works',
      error,
    });
  }

  // Backslash form of a path is only meaningful on Windows.
  if (isWindows) {
    try {
      const mixed = [nativeA, fwd(nativeB)];
      const { program, calls } = programWith(mixed);
      const r = summarize(program, calls, mixed);
      raw.programMixedRoots = { getRootFileNames: r.getRootFileNames, sourceFiles: r.sourceFiles };
      ctx.claim({
        id: 'typescript.input.rootNames.mixedForms',
        claim: 'mixing native and `/` roots yields the same, deduplicated source files',
        kind: 'input',
        expected: { foundA: true, sameSourceFiles: true },
        observed: {
          foundA: r.foundA,
          sameSourceFiles: nativeRun
            ? JSON.stringify(r.sourceFiles) === JSON.stringify(nativeRun.sourceFiles)
            : null,
        },
      });
    } catch (error) {
      ctx.claimError({
        id: 'typescript.input.rootNames.mixedForms',
        claim: 'mixed roots',
        kind: 'input',
        expected: 'works',
        error,
      });
    }
  } else {
    ctx.claim({
      id: 'typescript.input.rootNames.mixedForms',
      claim: 'mixing native and `/` roots',
      kind: 'input',
      expected: SKIP,
      observed: SKIP,
    });
  }

  // ---- resolveModuleName
  try {
    const rel = ts.resolveModuleName('./b', nativeA, options, ts.sys);
    const relFwd = ts.resolveModuleName('./b', fwd(nativeA), options, ts.sys);
    const bare = ts.resolveModuleName('dep', nativeA, options, ts.sys);
    raw.resolveModuleName = {
      relativeFromNative: rel.resolvedModule?.resolvedFileName,
      relativeFromForward: relFwd.resolvedModule?.resolvedFileName,
      bareFromNative: bare.resolvedModule?.resolvedFileName,
    };
    ctx.claim({
      id: 'typescript.resolveModuleName.resolvedFileName',
      claim:
        'resolveModuleName(..., nativeContainingFile).resolvedModule.resolvedFileName is `/`-separated (relative and bare)',
      kind: 'output',
      expected: {
        relativeFromNative: fwdExpected,
        relativeFromForward: fwdExpected,
        bareFromNative: fwdExpected,
      },
      observed: Object.fromEntries(
        Object.entries(raw.resolveModuleName).map(([k, v]) => [k, ctx.separatorStyle(v)])
      ),
      notes: 'raw.resolveModuleName',
    });
  } catch (error) {
    ctx.claimError({
      id: 'typescript.resolveModuleName.resolvedFileName',
      claim: 'resolveModuleName',
      kind: 'output',
      expected: fwdExpected,
      error,
    });
  }

  // ---- ts.sys (thin wrappers over node:fs / process) vs ts.* path helpers
  try {
    const relInput = path.relative(process.cwd(), nativeA);
    const sysVals = {
      'sys.resolvePath': ts.sys.resolvePath(relInput),
      'sys.realpath': ts.sys.realpath(nativeA),
      'sys.getCurrentDirectory': ts.sys.getCurrentDirectory(),
      'sys.getExecutingFilePath': ts.sys.getExecutingFilePath(),
    };
    const derived = {
      'ts.resolvePath (internal helper)': ts.resolvePath(nativeA),
      'ts.normalizePath (internal helper)': ts.normalizePath(nativeA),
      'sys.readDirectory': ts.sys.readDirectory(path.join(workDir, 'src'), ['.ts']),
      'host.getDefaultLibLocation': ts.createCompilerHost(options).getDefaultLibLocation(),
      'host.getCurrentDirectory': ts.createCompilerHost(options).getCurrentDirectory(),
    };
    raw.sys = { relInput, ...sysVals, ...derived };
    ctx.claim({
      id: 'typescript.sys.resolvePath',
      claim: 'ts.sys.resolvePath is node path.resolve, so it returns a NATIVE path (not `/`)',
      kind: 'output',
      expected: nativeExpected,
      observed: ctx.separatorStyle(sysVals['sys.resolvePath']),
      notes: 'contrast ts.resolvePath (internal path.ts helper) in raw.sys, which normalizes to /',
    });
    ctx.claim({
      id: 'typescript.sys.realpath',
      claim: 'ts.sys.realpath returns a native path',
      kind: 'output',
      expected: nativeExpected,
      observed: ctx.separatorStyle(sysVals['sys.realpath']),
    });
    ctx.claim({
      id: 'typescript.sys.getCurrentDirectory',
      claim: 'ts.sys.getCurrentDirectory() is process.cwd() (native)',
      kind: 'output',
      expected: nativeExpected,
      observed: ctx.separatorStyle(sysVals['sys.getCurrentDirectory']),
    });
    ctx.claim({
      id: 'typescript.sys.getExecutingFilePath',
      claim: 'ts.sys.getExecutingFilePath() is __filename (native)',
      kind: 'output',
      expected: nativeExpected,
      observed: ctx.separatorStyle(sysVals['sys.getExecutingFilePath']),
    });
    ctx.claim({
      id: 'typescript.normalizing.helpers',
      claim:
        'ts.resolvePath / ts.normalizePath / sys.readDirectory / host.getDefaultLibLocation return `/`',
      kind: 'output',
      expected: [fwdExpected],
      observed: styles(ctx, [
        derived['ts.resolvePath (internal helper)'],
        derived['ts.normalizePath (internal helper)'],
        ...derived['sys.readDirectory'],
        derived['host.getDefaultLibLocation'],
      ]),
    });
  } catch (error) {
    ctx.claimError({
      id: 'typescript.sys',
      claim: 'ts.sys path formats',
      kind: 'output',
      expected: nativeExpected,
      error,
    });
  }

  return raw;
}
