/**
 * Compile Angular source written inline in a test, so an assertion and the code it describes stay
 * on screen together.
 *
 * Sources go through a real `ts.Program` whose host serves the inline files from memory and falls
 * back to disk for everything else, so `lib.d.ts` and the real `@angular/core` resolve normally and
 * the analyzer sees the types a user's project would give it.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import type { AngularClassMeta, AngularFileMeta, Directive } from '../../types.ts';
import { analyzeSourceFile } from '../analyze-file.ts';

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
const VIRTUAL_DIR = normalize(join(dirname(fileURLToPath(import.meta.url)), '__inline__'));

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
  // Module resolution probes the containing directory before the file, and this one is not on disk.
  host.directoryExists = (directoryName) =>
    normalize(directoryName) === VIRTUAL_DIR || (realDirectoryExists?.(directoryName) ?? true);
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

const analyzeWith = (
  entry: string,
  files: Record<string, string>,
  options: ts.CompilerOptions
): AngularFileMeta => {
  const program = programFor(files, options);
  const sourceFile = program.getSourceFile(normalize(join(VIRTUAL_DIR, entry)));
  if (!sourceFile) {
    throw new Error(`${entry} missing from the program`);
  }
  return analyzeSourceFile(ts, sourceFile, program.getTypeChecker());
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
 * unreachable Angular types looks. Classic resolution never consults `node_modules`.
 */
export const analyzeWithUnresolvableAngular = (source: string): AngularFileMeta =>
  analyzeWith(
    'component.ts',
    { 'component.ts': source },
    {
      ...BASE_OPTIONS,
      moduleResolution: ts.ModuleResolutionKind.Classic,
    }
  );

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
