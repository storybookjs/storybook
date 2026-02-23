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
  private tsconfigCache = new Map<string, string | null>();

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
   * 1. findDirectIncludeTsconfig — check if file is in parsed fileNames
   * 2. findIndirectReferenceTsconfig — check via project references chain
   */
  private findMatchingTSConfig(filePath: string): string | null {
    // First, find the nearest tsconfig candidate
    const candidate = this.findNearestTSConfig(filePath);
    if (!candidate) return null;

    // Verify the file is actually included in this tsconfig
    const parsed = this.parseConfig(candidate);
    if (!parsed) return null;

    const normalizedFilePath = filePath.replace(/\\/g, '/');

    // Direct include check (Volar's findDirectIncludeTsconfig)
    const normalizedFileNames = new Set(
      parsed.fileNames.map((f) => f.replace(/\\/g, '/'))
    );
    if (normalizedFileNames.has(normalizedFilePath)) {
      return candidate;
    }

    // Project reference chain check (Volar's findIndirectReferenceTsconfig)
    const referencedConfig = this.findInProjectReferences(
      filePath,
      parsed,
      candidate,
      new Set()
    );
    if (referencedConfig) return referencedConfig;

    // Volar pattern: if the file isn't in any tsconfig (direct or via references),
    // return null to let the caller fall back to an inferred project with safe defaults.
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

      // Volar fix for #712: resolve directory references to tsconfig.json
      if (
        this.typescript.sys.directoryExists(refPath) ||
        (!refPath.endsWith('.json') && this.typescript.sys.directoryExists(refPath))
      ) {
        const tsconfigInDir = path.join(refPath, 'tsconfig.json');
        if (this.typescript.sys.fileExists(tsconfigInDir)) {
          refPath = tsconfigInDir;
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
   * Find the nearest tsconfig.json by walking up directories.
   *
   * Uses ts.findConfigFile to walk up the directory tree.
   * Results are cached per directory.
   */
  private findNearestTSConfig(filePath: string): string | null {
    let dir = path.dirname(filePath);
    while (true) {
      if (this.tsconfigCache.has(dir)) return this.tsconfigCache.get(dir)!;
      const result = this.typescript.findConfigFile(
        dir,
        this.typescript.sys.fileExists
      );
      this.tsconfigCache.set(dir, result ?? null);
      if (result) return result;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return null;
  }

  /**
   * Parse a tsconfig file with standard TS APIs.
   *
   * Applies Volar's patches:
   * - outDir = undefined (Volar fix for TypeScript#30457 / Volar#1786)
   * - Path normalization to forward slashes
   */
  private parseConfig(configPath: string): ts.ParsedCommandLine | null {
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

      return parsed;
    } catch {
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
   * Notify that a file has changed.
   *
   * Volar pattern (createChecker.ts lines 409-431):
   * Smart version bumping — only bump projects that actually know about this file.
   */
  onFileChanged(filePath: string) {
    for (const project of this.projects.values()) {
      project.onFileChanged(filePath, 'changed');
    }
    for (const project of this.inferredProjects.values()) {
      project.onFileChanged(filePath, 'changed');
    }
    // Clear shared snapshot so it's re-read from disk
    this.sharedSnapshots.delete(filePath);
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
    this.sharedSnapshots.delete(filePath);
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
    this.tsconfigCache.clear();
  }

  dispose() {
    for (const project of this.projects.values()) project.dispose();
    for (const project of this.inferredProjects.values()) project.dispose();
    this.projects.clear();
    this.inferredProjects.clear();
    this.tsconfigCache.clear();
    this.sharedSnapshots.clear();
  }
}
