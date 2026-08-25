/** LSP-style file change type broadcast to projects (Volar Kit checker vocabulary). */
export type FileChangeType = 'changed' | 'created' | 'deleted';

export interface FileChange {
  filePath: string;
  type: FileChangeType;
}

/**
 * Structural subset of `ts.ParsedCommandLine` the manager reads: `fileNames` for direct-include
 * matching and `projectReferences` for reference-chain walking.
 *
 * Deliberately not `ts.ParsedCommandLine`: this module's contract must not name types from the
 * `typescript` package. Renderers resolve their own `typescript` copy (frameworks even pin their
 * own versions), and a cross-instance `ts.ParsedCommandLine` comparison walks the entire
 * compiler-API graph (`errors` → `Diagnostic` → `SourceFile` → …), which both couples consumers to
 * core's instance (TS2345) and blows the checker's comparison stack (TS2321). A real
 * `ts.ParsedCommandLine` remains assignable to this shape.
 */
export interface ProjectCommandLine {
  fileNames: string[];
  projectReferences?: readonly { path: string }[];
}

/**
 * The two filesystem probes the manager needs during tsconfig discovery and watching. `typeof ts`
 * satisfies this (via `ts.sys`), so callers pass their own `typescript` module — without this
 * module ever naming the `typescript` package (see {@link ProjectCommandLine} for why).
 */
export interface ComponentMetaFileSystem {
  sys: {
    fileExists(path: string): boolean;
    directoryExists(path: string): boolean;
  };
}

export interface ProjectFileSystem {
  sys: {
    fileExists(path: string): boolean;
    readFile(path: string): string | undefined;
    getModifiedTime?(path: string): Date | undefined;
  };
}

/**
 * Contract a per-tsconfig project must satisfy for {@link ../ComponentMetaManager} to manage it.
 *
 * The manager only needs enough surface to match files to tsconfigs (parsed command lines,
 * `hasSourceFile`), keep projects fresh (`onFilesChanged`, `ensureFiles`), watch their source
 * directories (`getSourceFilePaths`), and reclaim memory (`dispose`). What a "project" actually is
 * — a TypeScript language service, a Volar checker — is the renderer's business.
 */
export interface ComponentMetaProjectBase {
  getCommandLine(): ProjectCommandLine;
  hasSourceFile(fileName: string): boolean;
  /** Add files to the project's root set (used for inferred projects and on-demand inclusion). */
  ensureFiles(fileNames: string[]): void;
  onFilesChanged(changes: FileChange[]): void;
  /** Non-node_modules source file paths of the current program, for directory watching. */
  getSourceFilePaths(): string[];
  dispose(): void;
}

/**
 * How a renderer turns tsconfigs into projects.
 *
 * `parseCommandLine` matters beyond project creation: the manager matches files to tsconfigs by the
 * parsed `fileNames`, so a renderer whose components are not plain TS must parse with its own
 * machinery (Vue's `createParsedCommandLine` includes `.vue` files; plain TS parsing would not).
 *
 * `CL` lets the factory keep full command-line fidelity internally (e.g. React's real
 * `ts.ParsedCommandLine`): whatever `parseCommandLine` returns is what `createConfiguredProject`
 * receives, while the manager itself only reads the {@link ProjectCommandLine} subset.
 */
export interface ComponentMetaProjectFactory<
  P extends ComponentMetaProjectBase,
  CL extends ProjectCommandLine = ProjectCommandLine,
> {
  parseCommandLine(tsconfig: string): CL;
  createConfiguredProject(commandLine: CL, tsconfig: string, getCommandLine: () => CL): P;
  /** Project for files no discovered tsconfig covers; owns its own default compiler options. */
  createInferredProject(): P;
  /**
   * Called when heap pressure recycles the projects. A factory-owned cache that outlives individual
   * projects has to be dropped here too, or the memory floor survives the mechanism meant to lower
   * it.
   */
  recycle?(): void;
  /** Called from the manager's `dispose()` so factory-owned caches die with the manager. */
  dispose?(): void;
}
