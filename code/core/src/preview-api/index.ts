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
} from './addons.ts';

/** DECORATORS API */
export { makeDecorator } from './addons.ts';

/**
 * ADDON API
 *
 * @deprecated
 */
export { addons, mockChannel } from './addons.ts';

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
export { DocsContext } from './preview-web.ts';

/** SIMULATION API */
export { simulatePageLoad, simulateDOMContentLoaded } from './preview-web.ts';

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
} from './store.ts';

/** CSF API */
export { createPlaywrightTest, getCsfFactoryAnnotations } from './modules/store/csf/index.ts';

export type { PropDescriptor } from './store.ts';

export { Tag } from '../shared/constants/tags.ts';

/** STORIES API */
export { StoryStore, type Report, ReporterAPI } from './store.ts';
export {
  Preview,
  PreviewWeb,
  PreviewWithSelection,
  UrlStore,
  WebView,
  emitTransformCode,
  pauseAnimations,
  waitForAnimations,
} from './preview-web.ts';
export type { SelectionStore, View } from './preview-web.ts';

/** OPEN SERVICE API (preview leaf — register only; types on `storybook/open-service`) */
export { registerService } from '../shared/open-service/preview.ts';
export { getServiceChannel, setServiceChannel } from '../shared/open-service/service-channel.ts';
