export { ComponentMetaManager, isFileInDir, sortTSConfigs } from './ComponentMetaManager.ts';
export { parseTsconfigCommandLine } from './parse-tsconfig.ts';
export type { FileExtensionInfo, TsconfigParserModule } from './parse-tsconfig.ts';
export {
  ProjectFileTracker,
  filterSourceFilePaths,
  isInNodeModules,
} from './ProjectFileTracker.ts';
export type { FileSnapshotCache } from './ProjectFileTracker.ts';
export type { ComponentMetaProjectBase, ComponentMetaProjectFactory, FileChange } from './types.ts';
