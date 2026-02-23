/**
 * PropExtractionProject — one TS LanguageService per tsconfig.
 *
 * Follows Volar's typescriptProjectLs.ts + createChecker.ts patterns:
 * - LanguageServiceHost with virtual probe file
 * - projectVersion++ on file changes (smart: only for known files)
 * - Shared fsFileSnapshots with mtime-based caching (owned by Manager)
 * - shouldCheckRootFiles flag for lazy tsconfig re-evaluation (Volar's createChecker.ts)
 * - tryAddFile for dynamic file inclusion (Volar's typescriptProjectLs.ts)
 * - Result cache keyed by file mtime
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
  private resultCache = new Map<string, { version: string; docs: ComponentDoc[] }>();

  /**
   * Volar pattern (createChecker.ts lines 436-447):
   * Lazy flag that defers tsconfig re-parsing until the next getProjectVersion()
   * or getScriptFileNames() call. Set on file creation/deletion.
   */
  private shouldCheckRootFiles = false;
  private getCommandLine: () => ts.ParsedCommandLine;

  readonly probeFilePath: string;

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
    this.probeFilePath = path.join(projectRoot, '__probe__.ts');

    // Store the initial commandLine and create a getter for lazy re-evaluation
    this.getCommandLine = () => this.commandLine;

    const self = this;
    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => {
        // Volar pattern: check root files lazily
        self.checkRootFilesUpdate();
        return [...self.commandLine.fileNames, self.probeFilePath];
      },
      getScriptVersion: (fileName) => {
        if (fileName === self.probeFilePath) return String(self.probeVersion);
        // Volar pattern: combine projectVersion with mtime for invalidation
        const mtime = self.typescript.sys.getModifiedTime?.(fileName)?.valueOf();
        return `${self.projectVersion}:${mtime ?? 0}`;
      },
      getScriptSnapshot: (fileName) => {
        if (fileName === self.probeFilePath) {
          return self.typescript.ScriptSnapshot.fromString(self.probeContent);
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
        f === self.probeFilePath || self.typescript.sys.fileExists(f),
      readFile: (f) =>
        f === self.probeFilePath
          ? self.probeContent
          : self.typescript.sys.readFile(f),
      // Volar pattern: expose project references for composite projects
      getProjectReferences: () => self.commandLine.projectReferences,
    };

    this.ls = self.typescript.createLanguageService(
      host,
      self.typescript.createDocumentRegistry()
    );
  }

  /**
   * Dynamically add a file to the project's file list.
   *
   * Volar pattern (typescriptProjectLs.ts lines 196-200):
   * Used for inferred projects and files not in tsconfig's include.
   */
  tryAddFile(fileName: string): void {
    const normalized = fileName.replace(/\\/g, '/');
    if (!this.commandLine.fileNames.includes(normalized)) {
      this.commandLine.fileNames.push(normalized);
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
        this.projectVersion++;
      }
    } catch {
      // Config parse failure — keep existing commandLine
    }
  }

  /**
   * Extract component documentation from a file.
   *
   * Flow:
   * 1. Check mtime-based result cache → return cached if unchanged
   * 2. Get candidates from the LS program
   * 3. Generate probe source → update virtual probe file → bump version
   * 4. Get fresh program (LS re-evaluates incrementally)
   * 5. Resolve conditional types from probe → build ComponentDocs
   */
  extractDocs(filePath: string): ComponentDoc[] {
    const version = String(
      this.typescript.sys.getModifiedTime?.(filePath)?.valueOf() ?? 0
    );
    const cached = this.resultCache.get(filePath);
    if (cached && cached.version === version) return cached.docs;

    // Step 1: Get candidates from exports WITHOUT a full program.
    // Parse just the source file to find uppercase exports — no checker needed.
    const candidates = this.getCandidatesFromSource(filePath);
    if (candidates.length === 0) return [];

    // Step 2: Generate probe source
    const probeDir = path.dirname(this.probeFilePath);
    let relativePath = path.relative(probeDir, filePath);
    relativePath = relativePath.replace(/\.(tsx?|jsx?)$/, '');
    if (!relativePath.startsWith('.')) relativePath = './' + relativePath;
    relativePath = relativePath.replace(/\\/g, '/');

    const { source, typeNameMap } = generateProbeSource(relativePath, candidates);
    this.probeContent = source;
    this.probeVersion++;

    // Step 3: Get program ONCE — LS evaluates probe + target together
    const program = this.ls.getProgram();
    if (!program) return [];

    const checker = program.getTypeChecker();
    const probeSF = program.getSourceFile(this.probeFilePath);
    if (!probeSF) return [];

    const propsTypes = resolveProbeTypes(
      this.typescript,
      checker,
      probeSF,
      typeNameMap
    );

    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) return [];

    const docs = extractFromProbe(
      this.typescript,
      checker,
      filePath,
      sourceFile,
      propsTypes
    );

    this.resultCache.set(filePath, { version, docs });
    return docs;
  }

  /**
   * Get export candidates from a source file WITHOUT building a full program.
   *
   * Parses just the one file with ts.createSourceFile to find exports.
   * Uppercase-first names (+ 'default') are candidates — the probe's
   * conditional type will filter non-components.
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
        // export { Foo, Bar } or export { default } from ...
        if (stmt.exportClause && this.typescript.isNamedExports(stmt.exportClause)) {
          for (const spec of stmt.exportClause.elements) {
            const name = spec.name.text;
            if (name === 'default') {
              candidates.push({ exportName: 'default', isDefault: true });
            } else if (/^[A-Z]/.test(name)) {
              candidates.push({ exportName: name, isDefault: false });
            }
          }
        }
      }
    }

    return candidates;
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
    const program = this.ls.getProgram();

    if (type === 'changed') {
      // Volar: only bump if file is actually in the program
      if (program?.getSourceFile(filePath)) {
        this.projectVersion++;
        this.resultCache.delete(filePath);
      }
    } else if (type === 'deleted') {
      if (program?.getSourceFile(filePath)) {
        this.projectVersion++;
        this.resultCache.delete(filePath);
        this.shouldCheckRootFiles = true;
      }
    } else if (type === 'created') {
      // New file — may need to be added to the program
      this.shouldCheckRootFiles = true;
    }
  }

  dispose() {
    this.ls.dispose();
    this.resultCache.clear();
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
