export { createGhostStoriesIndexer } from './ghost-stories-indexer';
export { ghostStoriesPlugin } from './vite-plugin';
export {
  isComponentFile,
  extractComponentName,
  detectReactComponents,
  analyzeComponentProps,
  generateFakeValue,
} from './component-detector';
export {
  GHOST_STORIES_VIRTUAL_PREFIX,
  parseGhostStoryModuleId,
  generateVirtualCsfContent,
} from './virtual-module-handler';

export type {
  GhostStoriesConfig,
  GhostStoryEntry,
  ComponentProp,
  PropType,
  VirtualStoryIndexInput,
} from './types';
