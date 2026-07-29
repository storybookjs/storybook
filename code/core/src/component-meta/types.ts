import type ts from 'typescript';

/** LSP-style file change type broadcast to projects (Volar Kit checker vocabulary). */
export type FileChangeType = 'changed' | 'created' | 'deleted';

export interface FileChange {
  filePath: string;
  type: FileChangeType;
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
  getCommandLine(): ts.ParsedCommandLine;
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
 */
export interface ComponentMetaProjectFactory<P extends ComponentMetaProjectBase> {
  parseCommandLine(tsconfig: string): ts.ParsedCommandLine;
  createConfiguredProject(
    commandLine: ts.ParsedCommandLine,
    tsconfig: string,
    getCommandLine: () => ts.ParsedCommandLine
  ): P;
  /** Project for files no discovered tsconfig covers; owns its own default compiler options. */
  createInferredProject(): P;
  /** Called from the manager's `dispose()` so factory-owned caches die with the manager. */
  dispose?(): void;
}
