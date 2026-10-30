/**
 * Compile Angular source written inline in a test, so an assertion and the code it describes stay
 * on screen together.
 *
 * Sources go through a real `ts.Program` whose host serves the inline files from memory and falls
 * back to disk for everything else, so `lib.d.ts` and the real `@angular/core` resolve normally and
 * the analyzer sees the types a user's project would give it.
 *
 * `STORYBOOK_DOCGEN_TS_API=native` compiles them on the native API of TypeScript 7.1 instead (the
 * `typescript-native` alias), which reads from disk: the files are written to a directory of their
 * own per worker process.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll } from 'vitest';

import ts from 'typescript';
import type { RawCompilerOptions, Snapshot, SyntheticProjectId } from 'typescript-native/sync';
import {
  type DocgenTypeChecker,
  type DocgenTypeScript,
  NativeFacades,
  createCompilerDocgenTypeScript,
  createNativeDocgenTypeScript,
} from '@storybook/component-meta-typescript';

import type { AngularClassMeta, AngularFileMeta, Directive } from '../../types.ts';
import { analyzeSourceFile, analyzerContext } from '../analyze-file.ts';
import type { AnalyzerContext } from '../context.ts';

const NATIVE = process.env.STORYBOOK_DOCGEN_TS_API === 'native';

const BASE_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.Latest,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: false,
  experimentalDecorators: true,
  allowJs: true,
  skipLibCheck: true,
  noEmit: true,
  allowImportingTsExtensions: true,
};

// TS spells `fileName` with forward slashes on every platform, so the virtual paths must too.
const normalize = (fileName: string) => fileName.replace(/\\/g, '/');

// Inside the package so `@angular/core` resolves up through the real `node_modules`; the directory
// itself never exists on disk.
const VIRTUAL_DIR = normalize(
  join(dirname(fileURLToPath(import.meta.url)), NATIVE ? `__inline__${process.pid}` : '__inline__')
);

/** Path the analyzer reports for a source passed to {@link analyzeInline}. */
export const ENTRY = `${VIRTUAL_DIR}/component.ts`;

// The analyzer falls back to bare-name matching when Angular's symbols do not resolve, so an
// unresolvable `@angular/core` would quietly turn most tests into much weaker ones than they read
// as, rather than failing.
if (!ts.resolveModuleName('@angular/core', ENTRY, BASE_OPTIONS, ts.sys).resolvedModule) {
  throw new Error(`@angular/core does not resolve from ${ENTRY}; run \`yarn\` first`);
}

// lib.d.ts and `@angular/core` are parsed once and shared, so a program per test stays cheap.
const realSourceFiles = new Map<string, ts.SourceFile | undefined>();

const programFor = (files: Record<string, string>, options: ts.CompilerOptions): ts.Program => {
  const virtual = new Map(
    Object.entries(files).map(([name, text]) => [normalize(join(VIRTUAL_DIR, name)), text])
  );
  const host = ts.createCompilerHost(options, true);
  const readRealFile = host.readFile.bind(host);
  const realFileExists = host.fileExists.bind(host);
  const getRealSourceFile = host.getSourceFile.bind(host);
  const realDirectoryExists = host.directoryExists?.bind(host);
  const realpath = host.realpath?.bind(host);

  host.readFile = (fileName) => virtual.get(normalize(fileName)) ?? readRealFile(fileName);
  host.fileExists = (fileName) => virtual.has(normalize(fileName)) || realFileExists(fileName);
  // Module resolution probes the containing directory before the file, and these are not on disk.
  host.directoryExists = (directoryName) =>
    [...virtual.keys()].some((name) => name.startsWith(`${normalize(directoryName)}/`)) ||
    (realDirectoryExists?.(directoryName) ?? true);
  host.realpath = (fileName) =>
    virtual.has(normalize(fileName)) ? fileName : (realpath?.(fileName) ?? fileName);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
    const text = virtual.get(normalize(fileName));
    if (text !== undefined) {
      return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
    }
    if (!realSourceFiles.has(fileName)) {
      realSourceFiles.set(
        fileName,
        getRealSourceFile(fileName, languageVersion, onError, shouldCreate)
      );
    }
    return realSourceFiles.get(fileName);
  };

  return ts.createProgram([...virtual.keys()], options, host);
};

interface Compiled {
  typescript: DocgenTypeScript;
  checker: DocgenTypeChecker;
  sourceFile: (name: string) => ts.SourceFile;
}

const sourceFileOf = (getSourceFile: (fileName: string) => unknown, name: string) => {
  const sourceFile = getSourceFile(normalize(join(VIRTUAL_DIR, name)));
  if (!sourceFile) {
    throw new Error(`${name} missing from the program`);
  }
  return sourceFile as ts.SourceFile;
};

const compilerTypeScript = createCompilerDocgenTypeScript(ts);

const compileWithCompilerApi = (
  files: Record<string, string>,
  options: ts.CompilerOptions
): Compiled => {
  const program = programFor(files, options);
  return {
    typescript: compilerTypeScript,
    checker: program.getTypeChecker(),
    sourceFile: (name) => sourceFileOf((fileName) => program.getSourceFile(fileName), name),
  };
};

// One compiler process and one snapshot chain per worker, so lib.d.ts and `@angular/core` are
// parsed once; each compile writes its files and notifies the process of what changed.
const native = NATIVE
  ? await (async () => {
      const modules = {
        sync: await import('typescript-native/sync'),
        ast: await import('typescript-native/ast'),
        factory: await import('typescript-native/ast/factory'),
      };
      const api = new modules.sync.API({ cwd: dirname(VIRTUAL_DIR) });
      const state = {
        modules,
        api,
        typescript: createNativeDocgenTypeScript(modules, api),
        snapshot: undefined as Snapshot | undefined,
        programId: undefined as SyntheticProjectId | undefined,
        written: [] as string[],
      };
      afterAll(() => {
        state.snapshot?.dispose();
        api.close();
        rmSync(VIRTUAL_DIR, { recursive: true, force: true });
      });
      return state;
    })()
  : undefined;

const NATIVE_ENUMS = {
  target: 'ScriptTarget',
  module: 'ModuleKind',
  moduleResolution: 'ModuleResolutionKind',
} as const;

// The native API's enums number their members differently, so the options are mapped by name.
const nativeOptions = (options: ts.CompilerOptions): RawCompilerOptions => {
  const { sync, ast } = native!.modules;
  const result: Record<string, unknown> = { ...options };
  for (const [option, enumName] of Object.entries(NATIVE_ENUMS)) {
    const value = options[option as keyof typeof NATIVE_ENUMS];
    if (value !== undefined) {
      const nativeEnum = (
        (enumName === 'ScriptTarget' ? ast : sync) as unknown as Record<
          string,
          Record<string, number>
        >
      )[enumName];
      result[option] = nativeEnum[(ts[enumName] as Record<number, string>)[value]];
    }
  }
  return result as RawCompilerOptions;
};

const compileWithNativeApi = (
  files: Record<string, string>,
  options: ts.CompilerOptions
): Compiled => {
  const state = native!;
  const paths = Object.entries(files).map(([name, text]) => {
    const fileName = normalize(join(VIRTUAL_DIR, name));
    mkdirSync(dirname(fileName), { recursive: true });
    writeFileSync(fileName, text);
    return fileName;
  });
  const deleted = state.written.filter((fileName) => !paths.includes(fileName));
  for (const fileName of deleted) {
    rmSync(fileName, { force: true });
  }
  const program = { rootFiles: paths, compilerOptions: nativeOptions(options) };
  const previous = state.snapshot;
  if (previous && state.programId) {
    state.snapshot = previous.update({
      fileNotifications: {
        changed: paths.filter((fileName) => state.written.includes(fileName)),
        created: paths.filter((fileName) => !state.written.includes(fileName)),
        deleted,
      },
      reconfigurePrograms: [{ id: state.programId, ...program }],
      ensurePrograms: true,
    });
    previous.dispose();
  } else {
    state.snapshot = state.api.createSnapshot({ createPrograms: [program] });
    state.programId = state.snapshot.operation.createdPrograms![0].id;
  }
  state.written = paths;
  const project = state.snapshot.getProgram(state.programId!)!.getProject();
  return {
    typescript: state.typescript,
    checker: new NativeFacades(project, state.typescript).createChecker(),
    sourceFile: (name) => sourceFileOf((fileName) => project.program.getSourceFile(fileName), name),
  };
};

const compile = NATIVE ? compileWithNativeApi : compileWithCompilerApi;

const analyzeWith = (
  entry: string,
  files: Record<string, string>,
  options: ts.CompilerOptions
): AngularFileMeta => {
  const { typescript, checker, sourceFile } = compile(files, options);
  return analyzeSourceFile(typescript, sourceFile(entry), checker);
};

/**
 * Analyze `source` with its live analyzer context, for argTypes tests that resolve named types: the
 * returned `context` is the one `analyzeSourceFile` ran under, so extraction sees the same checker
 * and TypeIndex the analysis did.
 */
export const analyzeForExtraction = (
  source: string,
  extraFiles: Record<string, string> = {}
): { meta: AngularFileMeta; context: AnalyzerContext } => {
  const { typescript, checker, sourceFile } = compile(
    { 'component.ts': source, ...extraFiles },
    BASE_OPTIONS
  );
  const context = analyzerContext(typescript, sourceFile('component.ts'), checker);
  return {
    meta: analyzeSourceFile(typescript, sourceFile('component.ts'), checker, context),
    context,
  };
};

/** Analyze `source` as `component.ts`; `extraFiles` are siblings it can import. */
export const analyzeInline = (
  source: string,
  extraFiles: Record<string, string> = {}
): AngularFileMeta => analyzeFiles('component.ts', { 'component.ts': source, ...extraFiles });

/** Analyze one of several files, for when the entry is not `component.ts`. */
export const analyzeFiles = (entry: string, files: Record<string, string>): AngularFileMeta =>
  analyzeWith(entry, files, BASE_OPTIONS);

/**
 * Analyze `source` in a program that cannot resolve `@angular/core`, which is how a project with
 * unreachable Angular types looks.
 */
export const analyzeWithUnresolvableAngular = (source: string): AngularFileMeta =>
  analyzeWith('component.ts', { 'component.ts': source }, { ...BASE_OPTIONS, noResolve: true });

/** The single component `source` declares, asserting there is exactly one. */
export const componentIn = (
  source: string,
  extraFiles?: Record<string, string>
): AngularClassMeta & Directive => {
  const meta = analyzeInline(source, extraFiles);
  if (meta.components.length !== 1) {
    throw new Error(`expected exactly one component, got ${meta.components.length}`);
  }
  return meta.components[0] as AngularClassMeta & Directive;
};

export const byName = <T extends { name: string }>(items: T[] | undefined, name: string): T => {
  const item = items?.find((candidate) => candidate.name === name);
  if (!item) {
    throw new Error(
      `no member named ${name} in [${(items ?? []).map((entry) => entry.name).join(', ')}]`
    );
  }
  return item;
};

export const names = (items: { name: string }[] = []) => items.map((item) => item.name);

// A union's members in the checker's order: TypeScript 7.1 sorts them, TypeScript 6 keeps source order.
export const checkerOrder = (members: string[]) => (NATIVE ? [...members].sort() : members);

// A union as the checker prints it, with its members in `checkerOrder`.
export const checkerUnion = (...members: string[]) => checkerOrder(members).join(' | ');

// A union's members in a fixed order, to compare type text whose order differs between the APIs.
export const unionMembers = (type: string | undefined) => type?.split(' | ').sort();
