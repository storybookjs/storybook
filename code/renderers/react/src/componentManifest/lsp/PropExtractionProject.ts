/**
 * PropExtractionProject — one TS LanguageService per tsconfig.
 *
 * Follows Volar's typescriptProjectLs.ts + createChecker.ts patterns:
 * - LanguageServiceHost with virtual probe file
 * - projectVersion++ on file changes (smart: only for known files)
 * - Shared fsFileSnapshots with mtime-based caching (owned by Manager)
 * - shouldCheckRootFiles flag for lazy tsconfig re-evaluation (Volar's createChecker.ts)
 * - tryAddFile for dynamic file inclusion (Volar's typescriptProjectLs.ts)
 *
 * The probe file is a virtual TypeScript file that imports from the target
 * component file and uses React's ComponentProps<typeof X> to extract props.
 * Updating probeContent + bumping probeVersion is enough — the LanguageService
 * sees a new version and re-evaluates incrementally.
 */
import * as path from 'path';
import type ts from 'typescript';
import {
  type ComponentDoc,
  extractFromProbe,
  generateProbeSource,
  resolveProbeTypes,
} from '../propExtractor';

export class PropExtractionProject {
  private ls: ts.LanguageService;
  private projectVersion = 0;
  private probeContent = '';
  private probeVersion = 0;
  /** Separate probe state for package imports — avoids clobbering with local probe. */
  private probeContentPkg = '';
  private probeVersionPkg = 0;
  /** Fast lookup for tryAddFile — mirrors commandLine.fileNames. */
  private fileNamesSet: Set<string>;
  /** Cached result for getScriptFileNames — invalidated on fileNames change. */
  private cachedFileNames: string[] | undefined;

  /**
   * Volar pattern (createChecker.ts lines 436-447):
   * Lazy flag that defers tsconfig re-parsing until the next getProjectVersion()
   * or getScriptFileNames() call. Set on file creation/deletion.
   */
  private shouldCheckRootFiles = false;

  readonly probeFilePath: string;
  /** Separate virtual file for package-import probes. */
  readonly probeFilePathPkg: string;

  constructor(
    private typescript: typeof ts,
    private commandLine: ts.ParsedCommandLine,
    public readonly configPath: string | undefined,
    /**
     * Shared snapshot cache owned by PropExtractionManager.
     *
     * Volar pattern (createChecker.ts line 83): module-level fsFileSnapshots.
     * Multiple projects referencing the same file (e.g. @types/react) share
     * one cached snapshot instead of reading from disk independently.
     */
    private sharedSnapshots: Map<
      string,
      [number | undefined, ts.IScriptSnapshot | undefined]
    > = new Map()
  ) {
    const projectRoot = configPath
      ? path.dirname(configPath)
      : commandLine.options.rootDir ?? process.cwd();
    // .tsx extension required for JSX elements in the probe
    this.probeFilePath = path.join(projectRoot, '__probe__.tsx');
    this.probeFilePathPkg = path.join(projectRoot, '__probe_pkg__.tsx');
    this.fileNamesSet = new Set(commandLine.fileNames);

    const self = this;

    // Volar pattern (createProject.ts line 52): spread ts.sys as base, then override.
    // This picks up getDirectories, readDirectory, directoryExists, realpath,
    // useCaseSensitiveFileNames, etc. without enumerating each one.
    const host: ts.LanguageServiceHost = {
      ...self.typescript.sys,
      // ts.sys.useCaseSensitiveFileNames is a boolean, but LanguageServiceHost
      // expects () => boolean. Override to match the interface.
      useCaseSensitiveFileNames: () => self.typescript.sys.useCaseSensitiveFileNames,

      // --- Volar pattern (createChecker.ts:370-372): ---
      // checkRootFilesUpdate() must be called here, not just in getScriptFileNames.
      // TS LS calls getProjectVersion() first — if the version string hasn't changed,
      // it skips getScriptFileNames() entirely. checkRootFilesUpdate() may bump
      // projectVersion (when new files match the tsconfig), ensuring TS LS picks up
      // the change on the next sync cycle.
      getProjectVersion: () => {
        self.checkRootFilesUpdate();
        return `${self.projectVersion}:${self.probeVersion}:${self.probeVersionPkg}`;
      },

      getScriptFileNames: () => {
        // Volar pattern (createChecker.ts): cache the file names array to avoid
        // re-creating it on every LS sync call. Invalidated when fileNames change.
        if (!self.cachedFileNames) {
          self.cachedFileNames = [...self.commandLine.fileNames, self.probeFilePath, self.probeFilePathPkg];
        }
        return self.cachedFileNames;
      },
      getScriptVersion: (fileName) => {
        if (fileName === self.probeFilePath) return String(self.probeVersion);
        if (fileName === self.probeFilePathPkg) return String(self.probeVersionPkg);
        // Volar pattern (createProject.ts:377-378): return '' for non-existent files
        if (!self.typescript.sys.fileExists(fileName)) return '';
        // Volar pattern: return mtime only. projectVersion is NOT included —
        // it controls whether the LS re-syncs (via getProjectVersion), not
        // whether individual files changed. Including it would make the LS
        // think ALL files changed on every invalidate() call.
        const mtime = self.typescript.sys.getModifiedTime?.(fileName)?.valueOf();
        return String(mtime ?? 0);
      },
      getScriptSnapshot: (fileName) => {
        if (fileName === self.probeFilePath) {
          return self.typescript.ScriptSnapshot.fromString(self.probeContent);
        }
        if (fileName === self.probeFilePathPkg) {
          return self.typescript.ScriptSnapshot.fromString(self.probeContentPkg);
        }
        // Volar pattern: mtime-based snapshot cache (shared across projects)
        const mtime = self.typescript.sys.getModifiedTime?.(fileName)?.valueOf();
        const cached = self.sharedSnapshots.get(fileName);
        if (cached && cached[0] === mtime) return cached[1];

        // Volar pattern (createChecker.ts lines 120-139):
        // Read from disk, cache with mtime, handle missing files
        if (self.typescript.sys.fileExists(fileName)) {
          const content = self.typescript.sys.readFile(fileName);
          const snapshot =
            content !== undefined
              ? self.typescript.ScriptSnapshot.fromString(content)
              : undefined;
          self.sharedSnapshots.set(fileName, [mtime, snapshot]);
          return snapshot;
        } else {
          self.sharedSnapshots.set(fileName, [mtime, undefined]);
          return undefined;
        }
      },
      getCompilationSettings: () => self.commandLine.options,
      getCurrentDirectory: () => projectRoot,
      getDefaultLibFileName: self.typescript.getDefaultLibFilePath,
      fileExists: (f) =>
        f === self.probeFilePath || f === self.probeFilePathPkg || self.typescript.sys.fileExists(f),
      // Volar pattern: route readFile through snapshot cache for consistency
      readFile: (f) => {
        if (f === self.probeFilePath) return self.probeContent;
        if (f === self.probeFilePathPkg) return self.probeContentPkg;
        const snapshot = host.getScriptSnapshot!(f);
        return snapshot ? snapshot.getText(0, snapshot.getLength()) : undefined;
      },
      // Volar pattern: expose project references for composite projects
      getProjectReferences: () => self.commandLine.projectReferences,
    };

    // Volar pattern: no DocumentRegistry — avoid shared state complications.
    // Volar never uses createDocumentRegistry; our snapshot cache handles sharing.
    this.ls = self.typescript.createLanguageService(host);
  }

  /**
   * Bump projectVersion to trigger LS re-sync.
   *
   * Volar equivalent: file watcher fires → projectVersion++.
   * Forces the LS to re-check getScriptVersion() (mtime) for every file
   * on the next getProgram() call. If no mtimes changed, the LS returns
   * the cached Program instantly. No application-level cache needed.
   */
  invalidate(): void {
    this.projectVersion++;
  }

  /**
   * Dynamically add a file to the project's file list.
   *
   * Volar pattern (typescriptProjectLs.ts lines 196-200):
   * Used for inferred projects and files not in tsconfig's include.
   */
  tryAddFile(fileName: string): void {
    const normalized = fileName.replace(/\\/g, '/');
    if (!this.fileNamesSet.has(normalized)) {
      this.fileNamesSet.add(normalized);
      this.commandLine.fileNames.push(normalized);
      this.cachedFileNames = undefined;
      this.projectVersion++;
    }
  }

  /**
   * Lazy root files re-check.
   *
   * Volar pattern (createChecker.ts lines 436-447):
   * Only re-evaluates the tsconfig when shouldCheckRootFiles is set
   * (after file creation or deletion). Compares old and new fileNames
   * to avoid unnecessary projectVersion bumps.
   */
  private checkRootFilesUpdate(): void {
    if (!this.shouldCheckRootFiles) return;
    this.shouldCheckRootFiles = false;

    // Only re-parse for configured projects (with a tsconfig)
    if (!this.configPath) return;

    try {
      const config = this.typescript.readJsonConfigFile(
        this.configPath,
        this.typescript.sys.readFile
      );
      const newCommandLine = this.typescript.parseJsonSourceFileConfigFileContent(
        config,
        this.typescript.sys,
        path.dirname(this.configPath),
        {},
        this.configPath
      );
      // Volar patch: outDir = undefined
      newCommandLine.options.outDir = undefined;
      newCommandLine.fileNames = newCommandLine.fileNames.map((f) =>
        f.replace(/\\/g, '/')
      );

      if (!arrayItemsEqual(newCommandLine.fileNames, this.commandLine.fileNames)) {
        this.commandLine.fileNames = newCommandLine.fileNames;
        this.fileNamesSet = new Set(newCommandLine.fileNames);
        this.cachedFileNames = undefined;
        this.projectVersion++;
      }
    } catch {
      // Config parse failure — keep existing commandLine
    }
  }

  /**
   * Extract component documentation from a single file.
   * Delegates to extractDocsBulk with a single-element array.
   */
  extractDocs(filePath: string): ComponentDoc[] {
    return this.extractDocsBulk([filePath]).get(filePath) ?? [];
  }

  /**
   * Bulk-extract component docs for multiple files in one pass.
   *
   * Volar pattern: one probe + one getProgram() call for ALL files.
   * This avoids N LS re-syncs (each checking getScriptVersion for every
   * project file). Instead: one sync, one type-check, extract all.
   *
   * Invalidation follows Volar's model: projectVersion is bumped once
   * per cycle (via getProjectVersion → checkRootFilesUpdate). The LS
   * detects mtime changes in getScriptVersion and recompiles only what
   * changed. No application-level mtime scanning needed — the LS handles it.
   */
  /** Debug timings from the last extractDocsBulk call. */
  lastBulkDebug: Record<string, unknown> = {};

  extractDocsBulk(filePaths: string[]): Map<string, ComponentDoc[]> {
    const debug: Record<string, unknown> = {};
    const results = new Map<string, ComponentDoc[]>();

    // Collect candidates for all files
    const tCandidates = performance.now();
    const fileEntries: Array<{
      filePath: string;
      relativePath: string;
      candidates: Array<{ exportName: string; isDefault: boolean }>;
    }> = [];

    for (const filePath of filePaths) {
      const candidates = this.getCandidatesFromSource(filePath);
      if (candidates.length === 0) {
        results.set(filePath, []);
        continue;
      }

      const probeDir = path.dirname(this.probeFilePath);
      let relativePath = path.relative(probeDir, filePath);
      relativePath = relativePath.replace(/\.(tsx?|jsx?)$/, '');
      if (!relativePath.startsWith('.')) relativePath = './' + relativePath;
      relativePath = relativePath.replace(/\\/g, '/');

      fileEntries.push({ filePath, relativePath, candidates });
    }
    debug.candidatesMs = Math.round(performance.now() - tCandidates);
    debug.fileEntries = fileEntries.length;
    debug.totalCandidates = fileEntries.reduce((s, e) => s + e.candidates.length, 0);

    if (fileEntries.length === 0) {
      this.lastBulkDebug = debug;
      return results;
    }

    // Build ONE mega-probe importing from all files.
    const tProbe = performance.now();
    const { source, perFileVarMaps, perFileDetMaps } = this.generateBulkProbeSource(fileEntries);
    debug.probeGenMs = Math.round(performance.now() - tProbe);
    debug.probeLines = source.split('\n').length;

    // Only update probe if content actually changed — stable probe means the
    // LS skips recompilation entirely (probeVersion unchanged → same getScriptVersion).
    const probeChanged = source !== this.probeContent;
    debug.probeChanged = probeChanged;
    if (probeChanged) {
      this.probeContent = source;
      this.probeVersion++;
    }

    // No application-level cache — Volar pattern: the LS handles all caching
    // internally. invalidate() bumps projectVersion → LS re-syncs → checks
    // getScriptVersion (mtime) for each file → only recompiles what changed.
    // If nothing changed, getProgram() returns the cached Program instantly.
    const tProgram = performance.now();
    const program = this.ls.getProgram();
    debug.getProgramMs = Math.round(performance.now() - tProgram);
    if (!program) {
      this.lastBulkDebug = debug;
      return results;
    }

    const tResolve = performance.now();
    const checker = program.getTypeChecker();
    const probeSF = program.getSourceFile(this.probeFilePath);
    if (!probeSF) {
      this.lastBulkDebug = debug;
      return results;
    }

    // Resolve props from probe: conditional types filter non-components,
    // JSX elements extract concrete props via getResolvedSignature.
    for (const entry of fileEntries) {
      const varMap = perFileVarMaps.get(entry.filePath)!;
      const detMap = perFileDetMaps.get(entry.filePath);
      const propsTypes = resolveProbeTypes(this.typescript, checker, probeSF, varMap, detMap);

      const sourceFile = program.getSourceFile(entry.filePath);
      if (!sourceFile) {
        results.set(entry.filePath, []);
        continue;
      }

      const docs = extractFromProbe(
        this.typescript,
        checker,
        entry.filePath,
        sourceFile,
        propsTypes
      );

      results.set(entry.filePath, docs);
    }
    debug.resolveAndExtractMs = Math.round(performance.now() - tResolve);

    this.lastBulkDebug = debug;
    return results;
  }

  /**
   * Generate a single probe source that imports from ALL files.
   * Uses file index prefix to avoid name collisions.
   *
   * Hybrid approach per candidate:
   * 1. Conditional type for detection (JSXElementConstructor check)
   * 2. JSX element for props extraction (getResolvedSignature)
   */
  private generateBulkProbeSource(
    fileEntries: Array<{
      filePath: string;
      relativePath: string;
      candidates: Array<{ exportName: string; isDefault: boolean }>;
    }>
  ): {
    source: string;
    perFileVarMaps: Map<string, Map<string, string>>;
    perFileDetMaps: Map<string, Map<string, string>>;
  } {
    const lines: string[] = [];
    lines.push(`import { JSXElementConstructor } from 'react';`);
    const perFileVarMaps = new Map<string, Map<string, string>>();
    const perFileDetMaps = new Map<string, Map<string, string>>();

    for (let i = 0; i < fileEntries.length; i++) {
      const { filePath, relativePath, candidates } = fileEntries[i];
      const prefix = `_f${i}_`;
      const varMap = new Map<string, string>();
      const detMap = new Map<string, string>();

      const hasDefault = candidates.some((c) => c.isDefault);
      const named = candidates.filter((c) => !c.isDefault);

      // Build import with prefixed names to avoid collisions
      const parts: string[] = [];
      if (hasDefault) parts.push(`${prefix}Default`);
      if (named.length > 0) {
        parts.push(
          `{ ${named.map((c) => `${c.exportName} as ${prefix}${c.exportName}`).join(', ')} }`
        );
      }

      if (parts.length > 0) {
        lines.push(`import ${parts.join(', ')} from '${relativePath}';`);
      }

      // Detection types + JSX elements
      if (hasDefault) {
        const detName = `${prefix}det_default`;
        const varName = `${prefix}el_default`;
        lines.push(
          `export type ${detName} = typeof ${prefix}Default extends JSXElementConstructor<any> ? true : never;`
        );
        lines.push(`export const ${varName} = <${prefix}Default />;`);
        detMap.set('default', detName);
        varMap.set('default', varName);
      }
      for (const c of named) {
        const detName = `${prefix}det_${c.exportName}`;
        const varName = `${prefix}el_${c.exportName}`;
        lines.push(
          `export type ${detName} = typeof ${prefix}${c.exportName} extends JSXElementConstructor<any> ? true : never;`
        );
        lines.push(`export const ${varName} = <${prefix}${c.exportName} />;`);
        detMap.set(c.exportName, detName);
        varMap.set(c.exportName, varName);
      }

      perFileVarMaps.set(filePath, varMap);
      perFileDetMaps.set(filePath, detMap);
    }

    return { source: lines.join('\n'), perFileVarMaps, perFileDetMaps };
  }

  /**
   * Get export candidates from a source file.
   *
   * First tries lightweight AST-only detection (no checker needed).
   * Falls back to checker-based detection when the file contains
   * `export *` re-exports (barrel files) — these can't be resolved
   * without TypeScript's module resolution.
   */
  private getCandidatesFromSource(
    filePath: string
  ): Array<{ exportName: string; isDefault: boolean }> {
    const content = this.typescript.sys.readFile(filePath);
    if (!content) return [];

    const sf = this.typescript.createSourceFile(
      filePath,
      content,
      this.typescript.ScriptTarget.Latest,
      true
    );

    const candidates: Array<{ exportName: string; isDefault: boolean }> = [];
    let hasStarExport = false;

    for (const stmt of sf.statements) {
      // export const Foo = ..., export function Foo, export class Foo, export interface Foo
      if (this.typescript.isExportAssignment(stmt)) {
        // export default ...
        candidates.push({ exportName: 'default', isDefault: true });
      } else if (hasExportModifier(this.typescript, stmt)) {
        if (hasDefaultModifier(this.typescript, stmt)) {
          candidates.push({ exportName: 'default', isDefault: true });
        } else {
          const name = getDeclarationName(this.typescript, stmt);
          if (name && /^[A-Z]/.test(name)) {
            candidates.push({ exportName: name, isDefault: false });
          }
        }
      } else if (this.typescript.isExportDeclaration(stmt)) {
        if (stmt.exportClause && this.typescript.isNamedExports(stmt.exportClause)) {
          // export { Foo, Bar } or export { default } from ...
          for (const spec of stmt.exportClause.elements) {
            const name = spec.name.text;
            if (name === 'default') {
              candidates.push({ exportName: 'default', isDefault: true });
            } else if (/^[A-Z]/.test(name)) {
              candidates.push({ exportName: name, isDefault: false });
            }
          }
        } else if (!stmt.exportClause) {
          // export * from '...' — barrel file, can't resolve without checker
          hasStarExport = true;
        }
      }
    }

    // For barrel files with `export *`, fall back to checker-based detection.
    // This uses the LS program's checker.getExportsOfModule() which correctly
    // resolves all re-exported symbols through the module graph.
    if (hasStarExport) {
      return this.getCandidatesFromChecker(filePath);
    }

    return candidates;
  }

  /**
   * Checker-based candidate extraction — fallback for barrel files.
   *
   * Uses checker.getExportsOfModule() to resolve `export *` re-exports.
   * More expensive than AST-only detection but handles all export patterns.
   */
  private getCandidatesFromChecker(
    filePath: string
  ): Array<{ exportName: string; isDefault: boolean }> {
    const program = this.ls.getProgram();
    if (!program) return [];

    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) return [];

    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) return [];

    const exports = checker.getExportsOfModule(moduleSymbol);
    return exports
      .filter((exp) => {
        const name = exp.getName();
        if (name !== 'default' && !/^[A-Z]/.test(name)) return false;
        const resolved =
          exp.flags & this.typescript.SymbolFlags.Alias
            ? checker.getAliasedSymbol(exp)
            : exp;
        return !!resolved.valueDeclaration;
      })
      .map((exp) => ({
        exportName: exp.getName(),
        isDefault: exp.getName() === 'default',
      }));
  }

  /**
   * Extract a single component's props by import specifier.
   *
   * Used for package imports (e.g. 'flowbite-react') where the resolved file
   * may be compiled JS. The probe imports directly from the specifier, letting
   * TypeScript resolve via tsconfig paths or node_modules .d.ts files.
   */
  extractDocByImport(
    importSpecifier: string,
    exportName: string
  ): ComponentDoc | undefined {
    const results = this.extractDocsByImportBulk([{ importSpecifier, exportName }]);
    return results.get(`${importSpecifier}::${exportName}`);
  }

  /**
   * Bulk-extract component docs for multiple package imports in one probe.
   *
   * Groups all exports by import specifier, builds ONE mega-probe, and
   * calls getProgram() once. Same pattern as extractDocsBulk but for
   * package imports instead of local files.
   */
  extractDocsByImportBulk(
    entries: Array<{ importSpecifier: string; exportName: string; memberAccess?: string; componentPath?: string }>
  ): Map<string, ComponentDoc> {
    const results = new Map<string, ComponentDoc>();
    if (entries.length === 0) return results;

    // Group by specifier for combined imports, preserving memberAccess
    const bySpecifier = new Map<string, Array<{ exportName: string; isDefault: boolean; memberAccess?: string }>>();
    for (const { importSpecifier, exportName, memberAccess } of entries) {
      let group = bySpecifier.get(importSpecifier);
      if (!group) {
        group = [];
        bySpecifier.set(importSpecifier, group);
      }
      group.push({ exportName, isDefault: exportName === 'default', memberAccess });
    }

    // Build ONE mega-probe for all specifiers using hybrid approach:
    // conditional types for detection + JSX elements for props extraction.
    //
    // When memberAccess is set (derived from the outermost JSX component,
    // e.g. `<Accordion.Root>` → memberAccess="Root"), probe the member
    // directly: `<Accordion.Root />`. Otherwise probe the import itself:
    // `<Button />`. resolveCompoundTypes is a last-resort fallback.
    const lines: string[] = [];
    lines.push(`import { JSXElementConstructor } from 'react';`);
    const varNameMap = new Map<string, string>();
    const detTypeMap = new Map<string, string>();

    let idx = 0;
    for (const [specifier, candidates] of bySpecifier) {
      const prefix = `_p${idx}_`;
      const hasDefault = candidates.some((c) => c.isDefault);
      const named = candidates.filter((c) => !c.isDefault);

      const parts: string[] = [];
      if (hasDefault) parts.push(`${prefix}Default`);
      if (named.length > 0) {
        parts.push(
          `{ ${named.map((c) => `${c.exportName} as ${prefix}${c.exportName}`).join(', ')} }`
        );
      }

      if (parts.length > 0) {
        lines.push(`import ${parts.join(', ')} from '${specifier}';`);
      }

      // Generate probe for each candidate.
      // When memberAccess is set (outermost JSX was e.g. <Accordion.Root>),
      // probe the member directly. Otherwise probe the import itself.
      if (hasDefault) {
        const defaultCandidate = candidates.find((c) => c.isDefault)!;
        const ma = defaultCandidate.memberAccess;
        const typeofExpr = ma ? `typeof ${prefix}Default.${ma}` : `typeof ${prefix}Default`;
        const jsxTag = ma ? `${prefix}Default.${ma}` : `${prefix}Default`;
        const detName = `${prefix}det_default`;
        const varName = `${prefix}el_default`;
        lines.push(
          `export type ${detName} = ${typeofExpr} extends JSXElementConstructor<any> ? true : never;`
        );
        lines.push(`export const ${varName} = <${jsxTag} />;`);
        detTypeMap.set(`${specifier}::default`, detName);
        varNameMap.set(`${specifier}::default`, varName);
      }
      for (const c of named) {
        const mapKey = `${specifier}::${c.exportName}`;
        const typeofExpr = c.memberAccess
          ? `typeof ${prefix}${c.exportName}.${c.memberAccess}`
          : `typeof ${prefix}${c.exportName}`;
        const jsxTag = c.memberAccess
          ? `${prefix}${c.exportName}.${c.memberAccess}`
          : `${prefix}${c.exportName}`;
        const detName = `${prefix}det_${c.exportName}`;
        const varName = `${prefix}el_${c.exportName}`;
        lines.push(
          `export type ${detName} = ${typeofExpr} extends JSXElementConstructor<any> ? true : never;`
        );
        lines.push(`export const ${varName} = <${jsxTag} />;`);
        detTypeMap.set(mapKey, detName);
        varNameMap.set(mapKey, varName);
      }
      idx++;
    }

    const source = lines.join('\n');
    if (source !== this.probeContentPkg) {
      this.probeContentPkg = source;
      this.probeVersionPkg++;
    }

    const program = this.ls.getProgram();
    if (!program) return results;

    const checker = program.getTypeChecker();
    const probeSF = program.getSourceFile(this.probeFilePathPkg);
    if (!probeSF) return results;

    // Resolve props: conditional types filter non-components, JSX extracts props.
    const allPropsTypes = resolveProbeTypes(this.typescript, checker, probeSF, varNameMap, detTypeMap);

    // Fallback: for entries where the probe failed (e.g. no memberAccess was provided
    // and the import is a namespace), inspect the type's properties to find component-like
    // ones (prefers "Root", then first with call signature).
    this.resolveCompoundTypes(checker, probeSF, entries, varNameMap, allPropsTypes);

    // Build lookup: mapKey → componentPath (source .tsx path from Storybook's resolver)
    const componentPaths = new Map<string, string>();
    for (const { importSpecifier, exportName, componentPath } of entries) {
      if (componentPath) {
        componentPaths.set(`${importSpecifier}::${exportName}`, componentPath);
      }
    }

    // Extract docs for each entry using the resolved props types
    for (const { importSpecifier, exportName } of entries) {
      const mapKey = `${importSpecifier}::${exportName}`;
      const propsType = allPropsTypes.get(mapKey);
      if (!propsType) continue;

      // Resolve import to find the actual source file
      const resolved = this.typescript.resolveModuleName(
        importSpecifier,
        this.probeFilePathPkg,
        this.commandLine.options,
        this.typescript.sys
      );
      const resolvedFileName = resolved.resolvedModule?.resolvedFileName;
      if (!resolvedFileName) continue;

      const sourceFile = program.getSourceFile(resolvedFileName);
      if (!sourceFile) continue;

      // When TypeScript resolves to a .d.ts file (e.g. package imports in monorepos),
      // pass the original source path so extractFromProbe can extract defaults from it.
      const defaultsSourcePath =
        resolvedFileName.endsWith('.d.ts') || resolvedFileName.endsWith('.d.mts') || resolvedFileName.endsWith('.d.cts')
          ? componentPaths.get(mapKey)
          : undefined;

      const propsTypes = new Map<string, ts.Type>([[exportName, propsType]]);
      const docs = extractFromProbe(
        this.typescript,
        checker,
        componentPaths.get(mapKey) ?? resolvedFileName,
        sourceFile,
        propsTypes,
        defaultsSourcePath
      );

      const doc = docs.find((d) => d.exportName === exportName);
      if (doc) results.set(mapKey, doc);
    }

    return results;
  }

  /**
   * Compound component detection.
   *
   * For entries where JSX resolution returned nothing (the imported symbol is
   * a namespace object like `Accordion` with `.Root`, `.Item`, etc.), inspects
   * the type's properties to find component-like ones.
   *
   * A property is component-like if it has call signatures (function component)
   * or construct signatures (class component). We pick the first one whose
   * first parameter resolves to a non-`any` props type.
   *
   * Mutates `allPropsTypes` in place — adds resolved props for compound entries.
   */
  private resolveCompoundTypes(
    checker: ts.TypeChecker,
    probeSF: ts.SourceFile,
    entries: Array<{ importSpecifier: string; exportName: string }>,
    varNameMap: Map<string, string>,
    allPropsTypes: Map<string, ts.Type>
  ): void {
    // Build a set of mapKeys that already have results
    const resolved = new Set<string>();
    for (const key of allPropsTypes.keys()) resolved.add(key);

    // Build a map: prefixed identifier name → mapKey
    // e.g. "_p0_Accordion" → "@park-ui/react::Accordion"
    const identToMapKey = new Map<string, string>();
    let idx = 0;
    const bySpecifier = new Map<string, Array<{ exportName: string }>>();
    for (const { importSpecifier, exportName } of entries) {
      let group = bySpecifier.get(importSpecifier);
      if (!group) {
        group = [];
        bySpecifier.set(importSpecifier, group);
      }
      group.push({ exportName });
    }
    for (const [specifier, candidates] of bySpecifier) {
      const prefix = `_p${idx}_`;
      for (const c of candidates) {
        const identName = c.exportName === 'default' ? `${prefix}Default` : `${prefix}${c.exportName}`;
        const mapKey = `${specifier}::${c.exportName}`;
        if (!resolved.has(mapKey)) {
          identToMapKey.set(identName, mapKey);
        }
      }
      idx++;
    }

    if (identToMapKey.size === 0) return;

    // Walk the probe AST to find import bindings for unresolved entries
    for (const stmt of probeSF.statements) {
      if (!this.typescript.isImportDeclaration(stmt)) continue;

      const clause = stmt.importClause;
      if (!clause) continue;

      // Check default import
      if (clause.name) {
        this.tryResolveCompound(checker, clause.name, identToMapKey, allPropsTypes);
      }

      // Check named imports
      if (clause.namedBindings && this.typescript.isNamedImports(clause.namedBindings)) {
        for (const spec of clause.namedBindings.elements) {
          this.tryResolveCompound(checker, spec.name, identToMapKey, allPropsTypes);
        }
      }
    }
  }

  /**
   * Try to resolve a compound component from an imported identifier.
   *
   * Gets the type of the identifier, enumerates its properties, and finds
   * the first one that's a component (has call/construct signatures with a
   * non-`any` first parameter).
   */
  private tryResolveCompound(
    checker: ts.TypeChecker,
    ident: ts.Identifier,
    identToMapKey: Map<string, string>,
    allPropsTypes: Map<string, ts.Type>
  ): void {
    const name = ident.text;
    const mapKey = identToMapKey.get(name);
    if (!mapKey) return;

    const sym = checker.getSymbolAtLocation(ident);
    if (!sym) return;

    const type = checker.getTypeOfSymbolAtLocation(sym, ident);
    const properties = checker.getPropertiesOfType(type);

    // Find component-like properties: ones with call signatures
    // whose first param is a non-`any` object type (= props).
    // Prefer "Root" if present (Ark UI / Radix convention), else first match.
    let bestProp: ts.Symbol | undefined;
    for (const prop of properties) {
      const propType = checker.getTypeOfSymbolAtLocation(prop, ident);
      const callSigs = checker.getSignaturesOfType(propType, this.typescript.SignatureKind.Call);
      if (callSigs.length === 0) continue;

      const sig = callSigs[0];
      const params = sig.getParameters();
      if (params.length === 0) continue;

      const propsType = checker.getTypeOfSymbolAtLocation(params[0], ident);
      if (propsType.flags & this.typescript.TypeFlags.Any) continue;

      if (prop.getName() === 'Root') {
        // Perfect match — use it immediately
        allPropsTypes.set(mapKey, propsType);
        return;
      }
      if (!bestProp) bestProp = prop;
    }

    // Use first component-like property as fallback
    if (bestProp) {
      const propType = checker.getTypeOfSymbolAtLocation(bestProp, ident);
      const callSigs = checker.getSignaturesOfType(propType, this.typescript.SignatureKind.Call);
      if (callSigs.length > 0) {
        const params = callSigs[0].getParameters();
        if (params.length > 0) {
          const propsType = checker.getTypeOfSymbolAtLocation(params[0], ident);
          allPropsTypes.set(mapKey, propsType);
        }
      }
    }
  }

  /**
   * Check if a file is in this project's TypeScript program.
   *
   * Volar's findIndirectReferenceTsconfig pattern:
   * Uses program.getSourceFile() to check for transitively included files
   * (imported but not necessarily in the tsconfig's include list).
   */
  hasSourceFile(filePath: string): boolean {
    return !!this.ls.getProgram()?.getSourceFile(filePath);
  }

  /**
   * Notify that a file has changed on disk.
   *
   * Volar pattern (createChecker.ts lines 409-431):
   * Smart version bumping based on change type:
   * - 'changed': only bump if the file is in the current program
   * - 'created': flag shouldCheckRootFiles (new files may match tsconfig include)
   * - 'deleted': bump if in program + flag shouldCheckRootFiles
   */
  onFileChanged(filePath: string, type: 'changed' | 'created' | 'deleted' = 'changed'): void {
    if (type === 'created') {
      // Volar: break immediately — once shouldCheckRootFiles is set,
      // checkRootFilesUpdate() will re-parse the entire tsconfig anyway.
      this.shouldCheckRootFiles = true;
      return;
    }

    const program = this.ls.getProgram();

    if (type === 'changed') {
      // Volar: only bump if file is actually in the program
      if (program?.getSourceFile(filePath)) {
        this.projectVersion++;
      }
    } else if (type === 'deleted') {
      if (program?.getSourceFile(filePath)) {
        this.projectVersion++;
        this.shouldCheckRootFiles = true;
      }
    }
  }

  dispose() {
    this.ls.dispose();
    // Note: sharedSnapshots is NOT cleared here — it's owned by the Manager
  }
}

/**
 * Compare two arrays for set equality (Volar's arrayItemsEqual pattern).
 */
function arrayItemsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  for (const file of b) {
    if (!set.has(file)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// AST helpers for getCandidatesFromSource — lightweight export detection
// ---------------------------------------------------------------------------

function hasExportModifier(typescript: typeof ts, node: ts.Statement): boolean {
  return (
    typescript.canHaveModifiers(node) &&
    !!typescript.getModifiers(node)?.some(
      (m) => m.kind === typescript.SyntaxKind.ExportKeyword
    )
  );
}

function hasDefaultModifier(typescript: typeof ts, node: ts.Statement): boolean {
  return (
    typescript.canHaveModifiers(node) &&
    !!typescript.getModifiers(node)?.some(
      (m) => m.kind === typescript.SyntaxKind.DefaultKeyword
    )
  );
}

function getDeclarationName(typescript: typeof ts, node: ts.Statement): string | undefined {
  // Only value-level declarations can be React components.
  // Interfaces, type aliases, and enums are type-only — skip them.
  if (
    typescript.isFunctionDeclaration(node) ||
    typescript.isClassDeclaration(node)
  ) {
    return node.name?.text;
  }
  if (typescript.isVariableStatement(node)) {
    const decl = node.declarationList.declarations[0];
    if (decl && typescript.isIdentifier(decl.name)) {
      return decl.name.text;
    }
  }
  return undefined;
}
