/**
 * PropExtractionManager — multi-project manager for prop extraction.
 *
 * Follows Volar's typescriptProject.ts pattern:
 * - configProjects: Map<tsconfig, PropExtractionProject> — one LS per tsconfig, lazy
 * - findTSConfig: walk up directories, then verify via direct include or project references
 * - Dispose + recreate on tsconfig change
 * - Inferred project fallback when no tsconfig is found (Volar's getOrCreateInferredProject)
 * - Shared fsFileSnapshots across all projects (Volar's module-level cache in createChecker.ts)
 * - Project reference chain resolution with cycle detection (Volar's getReferencesChains)
 *
 * Manages the lifecycle of PropExtractionProject instances and handles
 * tsconfig discovery for monorepo support (different packages get different
 * LS instances with their own compiler options).
 */
import * as path from 'path';
import type ts from 'typescript';
import { PropExtractionProject } from './PropExtractionProject';

/**
 * Sensible defaults for inferred projects. Numeric enum values are overridden
 * from the actual TS instance in getOrCreateInferredProject().
 */
const DEFAULT_INFERRED_OPTIONS: ts.CompilerOptions = {
  strict: true,
  esModuleInterop: true,
  allowJs: true,
  skipLibCheck: true,
};

export class PropExtractionManager {
  private projects = new Map<string, PropExtractionProject>();
  private inferredProjects = new Map<string, PropExtractionProject>();
  private parsedConfigCache = new Map<string, ts.ParsedCommandLine | null>();
  /** Volar pattern (searchedDirs): avoid re-scanning directories for tsconfig files. */
  private searchedDirs = new Set<string>();
  private rootTsConfigs = new Set<string>();

  /**
   * Shared snapshot cache across all projects.
   *
   * Volar pattern (createChecker.ts line 83): module-level fsFileSnapshots shared
   * across all checker instances. In a monorepo where multiple projects reference
   * the same node_modules files (@types/react, etc.), each file is read only once.
   */
  readonly sharedSnapshots = new Map<
    string,
    [number | undefined, ts.IScriptSnapshot | undefined]
  >();

  constructor(private typescript: typeof ts) {}

  /**
   * Get or create a PropExtractionProject for a given component file.
   *
   * Strategy (Volar's findMatchTSConfig pattern):
   * 1. Walk up to find candidate tsconfigs
   * 2. Verify the file is directly included OR reachable via project references
   * 3. Fall back to inferred project if no tsconfig matches
   */
  getProjectForFile(filePath: string): PropExtractionProject {
    const configPath = this.findMatchingTSConfig(filePath);
    if (configPath) {
      return this.getOrCreateConfiguredProject(configPath);
    }
    return this.getOrCreateInferredProject(filePath);
  }

  /**
   * Find a tsconfig that actually includes this file.
   *
   * Volar pattern (typescriptProject.ts lines 101-233):
   * 1. Collect ALL tsconfigs walking up (not just nearest)
   * 2. Sort by proximity (deepest path first, prefer containing directory)
   * 3. Pass 1: findDirectIncludeTsconfig — check parsed fileNames (cheap)
   * 4. Pass 2: findIndirectReferenceTsconfig — check via program.getSourceFile()
   *    (catches files that are imported but not in include list)
   */
  private findMatchingTSConfig(filePath: string): string | null {
    // Volar pattern: collect ALL tsconfigs walking up, not just nearest.
    // This handles cases where the nearest tsconfig doesn't include the file
    // but a parent tsconfig does (e.g. monorepo root with project references).
    const candidates = this.collectTSConfigs(filePath);
    if (candidates.length === 0) return null;

    // Volar's sortTSConfigs: deepest paths first (most specific),
    // prefer configs whose directory contains the file.
    candidates.sort((a, b) => sortTSConfigs(filePath, a, b));

    const normalizedFilePath = filePath.replace(/\\/g, '/');

    // Pass 1: Direct include — check parsed fileNames (cheap, no program needed)
    // Volar's findDirectIncludeTsconfig pattern
    for (const candidate of candidates) {
      const parsed = this.parseConfig(candidate);
      if (!parsed) continue;

      const normalizedFileNames = new Set(
        parsed.fileNames.map((f) => f.replace(/\\/g, '/'))
      );
      if (normalizedFileNames.has(normalizedFilePath)) {
        return candidate;
      }

      // Also check project reference chain (via fileNames)
      const referencedConfig = this.findInProjectReferences(
        filePath,
        parsed,
        candidate,
        new Set()
      );
      if (referencedConfig) return referencedConfig;
    }

    // Pass 2: Indirect — check via program.getSourceFile()
    // Volar's findIndirectReferenceTsconfig pattern: catches files that are
    // transitively imported but not in the tsconfig's include list.
    // Creates projects lazily (cached for reuse by subsequent files).
    for (const candidate of candidates) {
      if (!this.parseConfig(candidate)) continue;
      const project = this.getOrCreateConfiguredProject(candidate);
      if (project.hasSourceFile(normalizedFilePath)) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Recursively search project references for a file.
   *
   * Volar pattern (typescriptProject.ts lines 189-229):
   * Follows the reference chain with cycle detection, checking each
   * referenced tsconfig's fileNames for the target file.
   */
  private findInProjectReferences(
    filePath: string,
    commandLine: ts.ParsedCommandLine,
    tsConfigPath: string,
    visited: Set<string>
  ): string | null {
    if (!commandLine.projectReferences?.length) return null;
    if (visited.has(tsConfigPath)) return null; // Cycle detection
    visited.add(tsConfigPath);

    const normalizedFilePath = filePath.replace(/\\/g, '/');

    for (const ref of commandLine.projectReferences) {
      let refPath = ref.path.replace(/\\/g, '/');

      // Volar fix for #712: resolve directory references to tsconfig.json / jsconfig.json.
      // Project references can point to a directory (e.g. "../core") instead
      // of a file. Volar checks if the path is a directory and resolves to
      // the config file inside it.
      if (this.typescript.sys.directoryExists(refPath)) {
        const tsconfigInDir = path.join(refPath, 'tsconfig.json');
        const jsconfigInDir = path.join(refPath, 'jsconfig.json');
        if (this.typescript.sys.fileExists(tsconfigInDir)) {
          refPath = tsconfigInDir;
        } else if (this.typescript.sys.fileExists(jsconfigInDir)) {
          refPath = jsconfigInDir;
        }
      }

      if (!this.typescript.sys.fileExists(refPath)) continue;

      const refParsed = this.parseConfig(refPath);
      if (!refParsed) continue;

      // Check direct include in referenced project
      const refFileNames = new Set(
        refParsed.fileNames.map((f) => f.replace(/\\/g, '/'))
      );
      if (refFileNames.has(normalizedFilePath)) {
        return refPath;
      }

      // Recurse into nested references
      const nested = this.findInProjectReferences(
        filePath,
        refParsed,
        refPath,
        visited
      );
      if (nested) return nested;
    }

    return null;
  }

  /**
   * Collect ALL tsconfig.json and jsconfig.json files walking up from the file's directory.
   *
   * Volar pattern (typescriptProject.ts lines 101-133):
   * Don't stop at the nearest config — collect all candidates
   * so we can sort by proximity and try each one. This handles
   * monorepos where the nearest tsconfig may not include the file
   * but a parent tsconfig (with project references) does.
   *
   * Uses searchedDirs / rootTsConfigs caches (Volar pattern) to avoid
   * re-scanning directories that have already been checked.
   */
  private collectTSConfigs(filePath: string): string[] {
    let dir = path.dirname(filePath);
    while (true) {
      if (this.searchedDirs.has(dir)) break;
      this.searchedDirs.add(dir);
      for (const name of ['tsconfig.json', 'jsconfig.json']) {
        const configPath = path.join(dir, name);
        if (this.typescript.sys.fileExists(configPath)) {
          this.rootTsConfigs.add(configPath);
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    // Return configs that are ancestors of the file
    return [...this.rootTsConfigs].filter((config) => {
      const configDir = path.dirname(config).replace(/\\/g, '/');
      return filePath.replace(/\\/g, '/').startsWith(configDir + '/');
    });
  }

  /**
   * Parse a tsconfig file with standard TS APIs (cached).
   *
   * Volar pattern (typescriptProject.ts lines 230-233): Volar caches configs
   * implicitly by creating projects eagerly. We cache the ParsedCommandLine
   * directly to avoid re-parsing during project reference chain traversal.
   *
   * Applies Volar's patches:
   * - outDir = undefined (Volar fix for TypeScript#30457 / Volar#1786)
   * - Path normalization to forward slashes
   */
  private parseConfig(configPath: string): ts.ParsedCommandLine | null {
    if (this.parsedConfigCache.has(configPath)) {
      return this.parsedConfigCache.get(configPath)!;
    }

    try {
      const config = this.typescript.readJsonConfigFile(
        configPath,
        this.typescript.sys.readFile
      );
      const parsed = this.typescript.parseJsonSourceFileConfigFileContent(
        config,
        this.typescript.sys,
        path.dirname(configPath),
        {},
        configPath
      );

      // Volar patch (typescriptProjectLs.ts line 350):
      // Prevents TS LanguageService issues with outDir + rootDir + composite/incremental.
      // See: https://github.com/microsoft/TypeScript/issues/30457
      //      https://github.com/johnsoncodehk/volar/issues/1786
      parsed.options.outDir = undefined;

      // Volar pattern (typescriptProjectLs.ts line 351):
      // Normalize all file names to forward slashes for consistency.
      parsed.fileNames = parsed.fileNames.map((f) => f.replace(/\\/g, '/'));

      this.parsedConfigCache.set(configPath, parsed);
      return parsed;
    } catch {
      this.parsedConfigCache.set(configPath, null);
      return null;
    }
  }

  /**
   * Get or create a configured project (backed by a tsconfig).
   */
  private getOrCreateConfiguredProject(configPath: string): PropExtractionProject {
    let project = this.projects.get(configPath);
    if (!project) {
      const parsed = this.parseConfig(configPath);
      if (!parsed) {
        // Fall back to inferred project keyed by the config's directory (not the config
        // path itself). Volar pattern: inferred projects are always keyed by directory.
        return this.getOrCreateInferredProject(path.dirname(configPath));
      }
      project = new PropExtractionProject(
        this.typescript,
        parsed,
        configPath,
        this.sharedSnapshots
      );
      this.projects.set(configPath, project);
    }
    return project;
  }

  /**
   * Get or create an inferred project (no tsconfig found).
   *
   * Volar pattern (typescriptProject.ts lines 258-284):
   * Creates a project with default compiler options, keyed by the workspace
   * directory. Dynamically adds files via tryAddFile.
   */
  private getOrCreateInferredProject(filePath: string): PropExtractionProject {
    const dir = path.dirname(filePath);

    let project = this.inferredProjects.get(dir);
    if (!project) {
      const parsed: ts.ParsedCommandLine = {
        options: {
          ...DEFAULT_INFERRED_OPTIONS,
          // All enum-valued options from the actual TS instance — no hardcoded numbers.
          // Volar pattern: use runtime enum values, not compile-time constants.
          target: this.typescript.ScriptTarget.Latest,
          module: this.typescript.ModuleKind.ESNext,
          moduleResolution: this.typescript.ModuleResolutionKind.Bundler,
          jsx: this.typescript.JsxEmit.ReactJSX,
        },
        fileNames: [],
        errors: [],
      };

      project = new PropExtractionProject(
        this.typescript,
        parsed,
        undefined, // No config path for inferred projects
        this.sharedSnapshots
      );
      this.inferredProjects.set(dir, project);
    }

    // Volar pattern (typescriptProjectLs.ts line 196-200):
    // Dynamically add the file if not already included.
    project.tryAddFile(filePath);

    return project;
  }

  /**
   * Bump projectVersion on all projects for a new extraction cycle.
   *
   * Equivalent of Volar's file watcher → projectVersion++.
   * Each project bumps its version so the next extractDocsBulk call
   * will re-check getScriptVersion for all files, detect mtime changes,
   * and incrementally recompile only what changed.
   */
  invalidate(): void {
    for (const project of this.projects.values()) project.invalidate();
    for (const project of this.inferredProjects.values()) project.invalidate();
  }

  /**
   * Volar pattern: no snapshot cache clearing on file changes.
   * The mtime-based cache in getScriptSnapshot handles it:
   * next access checks getModifiedTime() → mtime differs → re-reads from disk.
   */
  onFileChanged(filePath: string) {
    for (const project of this.projects.values()) {
      project.onFileChanged(filePath, 'changed');
    }
    for (const project of this.inferredProjects.values()) {
      project.onFileChanged(filePath, 'changed');
    }
  }

  /**
   * Notify that a file has been created.
   *
   * Volar pattern: file creation may change which files are in the program.
   * Flags projects to re-check their root files.
   */
  onFileCreated(filePath: string) {
    for (const project of this.projects.values()) {
      project.onFileChanged(filePath, 'created');
    }
  }

  /**
   * Notify that a file has been deleted.
   *
   * Volar pattern: file deletion removes from program + triggers root file re-check.
   */
  onFileDeleted(filePath: string) {
    for (const project of this.projects.values()) {
      project.onFileChanged(filePath, 'deleted');
    }
  }

  /**
   * Notify that a tsconfig has changed.
   * Disposes and removes the affected project (Volar pattern: dispose + recreate).
   * Clears tsconfig cache since file→tsconfig mapping may have changed.
   */
  onConfigChanged(configPath: string) {
    const project = this.projects.get(configPath);
    if (project) {
      project.dispose();
      this.projects.delete(configPath);
    }
    this.parsedConfigCache.clear();
    this.searchedDirs.clear();
    this.rootTsConfigs.clear();
  }

  dispose() {
    for (const project of this.projects.values()) project.dispose();
    for (const project of this.inferredProjects.values()) project.dispose();
    this.projects.clear();
    this.inferredProjects.clear();
    this.parsedConfigCache.clear();
    this.sharedSnapshots.clear();
    this.searchedDirs.clear();
    this.rootTsConfigs.clear();
  }
}

/**
 * Sort tsconfig candidates by priority (Volar's sortTSConfigs pattern).
 *
 * Priority order:
 * 1. Prefer configs whose directory contains the file
 * 2. Prefer deeper paths (more specific tsconfig)
 * 3. Prefer tsconfig.json over other config names
 */
function sortTSConfigs(filePath: string, a: string, b: string): number {
  const dirA = path.dirname(a).replace(/\\/g, '/');
  const dirB = path.dirname(b).replace(/\\/g, '/');
  const normalizedFile = filePath.replace(/\\/g, '/');

  const inA = normalizedFile.startsWith(dirA + '/');
  const inB = normalizedFile.startsWith(dirB + '/');

  if (inA !== inB) {
    return (inB ? 1 : 0) - (inA ? 1 : 0);
  }

  const aLength = a.split('/').length;
  const bLength = b.split('/').length;

  if (aLength === bLength) {
    const aWeight = path.basename(a) === 'tsconfig.json' ? 1 : 0;
    const bWeight = path.basename(b) === 'tsconfig.json' ? 1 : 0;
    return bWeight - aWeight;
  }

  return bLength - aLength;
}
