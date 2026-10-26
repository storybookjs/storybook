export { ComponentMetaManager, isFileInDir, sortTSConfigs } from './ComponentMetaManager.ts';
export { extractComponentJsDocInfo, resolveExportedSymbol } from './jsdoc-info.ts';
export type {
  ComponentJsDocInfo,
  JsDocExportCheckerLike,
  JsDocExportSymbolLike,
  JsDocHost,
  JsDocSymbolLike,
} from './jsdoc-info.ts';
export { parseTsconfigCommandLine } from './parse-tsconfig.ts';
export type { FileExtensionInfo, TsconfigParserModule } from './parse-tsconfig.ts';
export { ProjectFileTracker, filterSourceFilePaths } from './ProjectFileTracker.ts';
export { ProgramBackedProject } from './ProgramBackedProject.ts';
export type { ProgramLike, ProgramProvider } from './ProgramBackedProject.ts';
export type { FileSnapshotCache } from './ProjectFileTracker.ts';
export type { ComponentMetaProjectBase, ComponentMetaProjectFactory, FileChange } from './types.ts';
