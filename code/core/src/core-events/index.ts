// eslint-disable-next-line @typescript-eslint/naming-convention
enum events {
  CHANNEL_WS_DISCONNECT = 'channelWSDisconnect',
  CHANNEL_CREATED = 'channelCreated',
  // There was an error executing the config, likely an bug in the user's preview.js
  CONFIG_ERROR = 'configError',
  // The (v7 store) story index has changed, needs to refetch
  STORY_INDEX_INVALIDATED = 'storyIndexInvalidated',
  // When the preview boots, the first story is chosen via a selection specifier
  STORY_SPECIFIED = 'storySpecified',
  // Emitted by Provider.setOptions is called from an manager-addon or manager.js file
  SET_CONFIG = 'setConfig',
  // Emitted by the preview whenever the list of stories changes (in batches) - legacy pre-7.0 event
  SET_STORIES = 'setStories',
  // Emitted by the preview whenever the list of entries changes - legacy event for v6 store
  SET_INDEX = 'setIndex',
  // Set the current story selection in the preview
  SET_CURRENT_STORY = 'setCurrentStory',
  // The current story changed due to the above
  CURRENT_STORY_WAS_SET = 'currentStoryWasSet',
  // Force the current story to re-render, without changing args
  FORCE_RE_RENDER = 'forceReRender',
  // Force the current story to re-render from scratch, with its initial args
  FORCE_REMOUNT = 'forceRemount',
  // Request the story has been loaded into the store, ahead of time, before it's actually
  PRELOAD_ENTRIES = 'preloadStories',
  // The story has been loaded into the store, we have parameters/args/etc
  STORY_PREPARED = 'storyPrepared',
  // The a docs entry has been loaded into the store, we have parameters
  DOCS_PREPARED = 'docsPrepared',
  // The next 6 events are emitted by the StoryRenderer when rendering the current story
  STORY_CHANGED = 'storyChanged',
  STORY_UNCHANGED = 'storyUnchanged',
  STORY_RENDERED = 'storyRendered',
  STORY_MISSING = 'storyMissing',
  STORY_ERRORED = 'storyErrored',
  STORY_THREW_EXCEPTION = 'storyThrewException',
  // Emitted at various times during rendering
  STORY_RENDER_PHASE_CHANGED = 'storyRenderPhaseChanged',
  // Emitted when the play function throws
  PLAY_FUNCTION_THREW_EXCEPTION = 'playFunctionThrewException',
  // Emitted when there were unhandled errors while playing the story
  UNHANDLED_ERRORS_WHILE_PLAYING = 'unhandledErrorsWhilePlaying',
  // Tell the story store to update (a subset of) a stories arg values
  UPDATE_STORY_ARGS = 'updateStoryArgs',
  // The values of a stories args just changed
  STORY_ARGS_UPDATED = 'storyArgsUpdated',
  // Reset either a single arg of a story all args of a story
  RESET_STORY_ARGS = 'resetStoryArgs',
  // Emitted after a filter is set
  SET_FILTER = 'setFilter',
  // Emitted by the preview at startup once it knows the initial set of globals+globalTypes
  SET_GLOBALS = 'setGlobals',
  // Tell the preview to update the value of a global
  UPDATE_GLOBALS = 'updateGlobals',
  // A global was just updated
  GLOBALS_UPDATED = 'globalsUpdated',
  REGISTER_SUBSCRIPTION = 'registerSubscription',
  // Tell the manager that the user pressed a key in the preview
  PREVIEW_KEYDOWN = 'previewKeydown',
  // Tell the preview that the builder is in progress
  PREVIEW_BUILDER_PROGRESS = 'preview_builder_progress',
  // Used in the manager to change the story selection
  SELECT_STORY = 'selectStory',
  STORIES_COLLAPSE_ALL = 'storiesCollapseAll',
  STORIES_EXPAND_ALL = 'storiesExpandAll',
  DOCS_RENDERED = 'docsRendered',
  SHARED_STATE_CHANGED = 'sharedStateChanged',
  SHARED_STATE_SET = 'sharedStateSet',
  NAVIGATE_URL = 'navigateUrl',
  UPDATE_QUERY_PARAMS = 'updateQueryParams',

  REQUEST_WHATS_NEW_DATA = 'requestWhatsNewData',
  RESULT_WHATS_NEW_DATA = 'resultWhatsNewData',
  SET_WHATS_NEW_CACHE = 'setWhatsNewCache',
  TOGGLE_WHATS_NEW_NOTIFICATIONS = 'toggleWhatsNewNotifications',
  TELEMETRY_ERROR = 'telemetryError',

  FILE_COMPONENT_SEARCH_REQUEST = 'fileComponentSearchRequest',
  FILE_COMPONENT_SEARCH_RESPONSE = 'fileComponentSearchResponse',
  SAVE_STORY_REQUEST = 'saveStoryRequest',
  SAVE_STORY_RESPONSE = 'saveStoryResponse',
  ARGTYPES_INFO_REQUEST = 'argtypesInfoRequest',
  ARGTYPES_INFO_RESPONSE = 'argtypesInfoResponse',
  CREATE_NEW_STORYFILE_REQUEST = 'createNewStoryfileRequest',
  CREATE_NEW_STORYFILE_RESPONSE = 'createNewStoryfileResponse',

  TESTING_MODULE_CRASH_REPORT = 'testingModuleCrashReport',
  TESTING_MODULE_PROGRESS_REPORT = 'testingModuleProgressReport',
  TESTING_MODULE_RUN_REQUEST = 'testingModuleRunRequest',
  TESTING_MODULE_CANCEL_TEST_RUN_REQUEST = 'testingModuleCancelTestRunRequest',
  TESTING_MODULE_CANCEL_TEST_RUN_RESPONSE = 'testingModuleCancelTestRunResponse',
  TESTING_MODULE_WATCH_MODE_REQUEST = 'testingModuleWatchModeRequest',
}

// Enables: `import Events from ...`
export default events;

// Enables: `import * as Events from ...` or `import { CHANNEL_CREATED } as Events from ...`
// This is the preferred method
export const {
  CHANNEL_WS_DISCONNECT,
  CHANNEL_CREATED,
  CONFIG_ERROR,
  CREATE_NEW_STORYFILE_REQUEST,
  CREATE_NEW_STORYFILE_RESPONSE,
  CURRENT_STORY_WAS_SET,
  DOCS_PREPARED,
  DOCS_RENDERED,
  FILE_COMPONENT_SEARCH_REQUEST,
  FILE_COMPONENT_SEARCH_RESPONSE,
  FORCE_RE_RENDER,
  FORCE_REMOUNT,
  GLOBALS_UPDATED,
  NAVIGATE_URL,
  PLAY_FUNCTION_THREW_EXCEPTION,
  UNHANDLED_ERRORS_WHILE_PLAYING,
  PRELOAD_ENTRIES,
  PREVIEW_BUILDER_PROGRESS,
  PREVIEW_KEYDOWN,
  REGISTER_SUBSCRIPTION,
  RESET_STORY_ARGS,
  SELECT_STORY,
  SET_CONFIG,
  SET_CURRENT_STORY,
  SET_FILTER,
  SET_GLOBALS,
  SET_INDEX,
  SET_STORIES,
  SHARED_STATE_CHANGED,
  SHARED_STATE_SET,
  STORIES_COLLAPSE_ALL,
  STORIES_EXPAND_ALL,
  STORY_ARGS_UPDATED,
  STORY_CHANGED,
  STORY_ERRORED,
  STORY_INDEX_INVALIDATED,
  STORY_MISSING,
  STORY_PREPARED,
  STORY_RENDER_PHASE_CHANGED,
  STORY_RENDERED,
  STORY_SPECIFIED,
  STORY_THREW_EXCEPTION,
  STORY_UNCHANGED,
  UPDATE_GLOBALS,
  UPDATE_QUERY_PARAMS,
  UPDATE_STORY_ARGS,
  REQUEST_WHATS_NEW_DATA,
  RESULT_WHATS_NEW_DATA,
  SET_WHATS_NEW_CACHE,
  TOGGLE_WHATS_NEW_NOTIFICATIONS,
  TELEMETRY_ERROR,
  SAVE_STORY_REQUEST,
  SAVE_STORY_RESPONSE,
  ARGTYPES_INFO_REQUEST,
  ARGTYPES_INFO_RESPONSE,
  TESTING_MODULE_CRASH_REPORT,
  TESTING_MODULE_PROGRESS_REPORT,
  TESTING_MODULE_RUN_REQUEST,
  TESTING_MODULE_CANCEL_TEST_RUN_REQUEST,
  TESTING_MODULE_CANCEL_TEST_RUN_RESPONSE,
  TESTING_MODULE_WATCH_MODE_REQUEST,
} = events;

export * from './data/create-new-story';
export * from './data/file-component-search';
export * from './data/argtypes-info';
export * from './data/request-response';
export * from './data/save-story';
export * from './data/whats-new';
export * from './data/testing-module';
