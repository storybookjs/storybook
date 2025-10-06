/// <reference path="../typings.d.ts" />

/** HOOKS API */
export {
  useArgs,
  useCallback,
  useChannel,
  useEffect,
  useGlobals,
  useMemo,
  useParameter,
  useReducer,
  useRef,
  useState,
  useStoryContext,
  applyHooks,
  HooksContext,
} from './addons';

/** DECORATORS API */
export { makeDecorator } from './addons';

/**
 * ADDON API
 *
 * @deprecated
 */
export { addons, mockChannel } from './addons';

// TODO: Universal Stores are disabled in the preview, until we get automatic leader negotiation in place
// export { UniversalStore as experimental_UniversalStore } from '../shared/universal-store';
// export { useUniversalStore as experimental_useUniversalStore } from '../shared/universal-store/use-universal-store-preview';
// export { MockUniversalStore as experimental_MockUniversalStore } from '../shared/universal-store/mock';
// export {
//   getStatusStoreByTypeId as experimental_getStatusStore,
//   useStatusStore as experimental_useStatusStore,
//   fullStatusStore as internal_fullStatusStore,
// } from './stores/status';

/** DOCS API */
export { DocsContext } from './preview-web';

/** SIMULATION API */
export { simulatePageLoad, simulateDOMContentLoaded } from './preview-web';

export {
  combineArgs,
  combineParameters,
  composeConfigs,
  composeStepRunners,
  composeStories,
  composeStory,
  decorateStory,
  defaultDecorateStory,
  prepareStory,
  prepareMeta,
  normalizeArrays,
  normalizeStory,
  filterArgTypes,
  sanitizeStoryContextUpdate,
  setDefaultProjectAnnotations,
  setProjectAnnotations,
  inferControls,
  userOrAutoTitleFromSpecifier,
  userOrAutoTitle,
  sortStoriesV7,
  normalizeProjectAnnotations,
} from './store';

/** CSF API */
export { createPlaywrightTest, getCsfFactoryAnnotations } from './modules/store/csf';

export type { PropDescriptor } from './store';

/** STORIES API */
export { StoryStore, type Report, ReporterAPI } from './store';
export {
  Preview,
  PreviewWeb,
  PreviewWithSelection,
  UrlStore,
  WebView,
  emitTransformCode,
  pauseAnimations,
  waitForAnimations,
} from './preview-web';
export type { SelectionStore, View } from './preview-web';
