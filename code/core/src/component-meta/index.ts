export { ComponentMetaManager, isFileInDir, sortTSConfigs } from './ComponentMetaManager.ts';
export {
  getDeclaredLiterals,
  orderPropertiesByDeclaration,
  orderUnionMembers,
  printUnionMembers,
} from './declaration-order.ts';
export type {
  DeclarationOrderChecker,
  DeclarationOrderFlags,
  DeclarationOrderHost,
  DeclaredSymbolLike,
  UnionMemberLike,
} from './declaration-order.ts';
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
export type {
  ComponentMetaProjectBase,
  ComponentMetaProjectFactory,
  FileChange,
  ProjectCommandLine,
} from './types.ts';
