import {
  build as buildFromServer,
  buildDevStandalone as buildDevStandaloneFromServer,
  exitOnDevServerSignal,
} from 'storybook/internal/server';

type DevServer = Awaited<ReturnType<typeof buildDevStandaloneFromServer>>;

/** @deprecated Compatibility entry for addons that still import `storybook/internal/core-server`; use `storybook/internal/{server,services,story-index}`. */
export type {
  BuildIndexOptions,
  ComponentArgTypesData,
  DocsManifestEntry,
  DocsManifestRefEntry,
  JsonRef,
  MdxDocPayload,
  MdxError,
  MdxPayload,
  MdxServiceContract,
} from 'storybook/internal/story-index';
export type {
  ChangeDetectionAdapter,
  Command,
  CommandCtx,
  CommandDefinition,
  DocsAccess,
  Experimental_ChangeDetectionReadiness,
  FileChangeEvent,
  FoundStory,
  ImportEdge,
  ImportParser,
  ImportParserContext,
  ModuleGraphService,
  ModuleResolveConfig,
  NotFoundStory,
  OperationDescriptor,
  ParseFileArgs,
  PreviewStoriesOutput,
  Query,
  QueryCtx,
  QueryDefinition,
  ResolvedDocsEntry,
  RuntimeService,
  SchemaDescriptor,
  ServerServiceRegistration,
  ServiceDefinition,
  ServiceDescriptor,
  ServiceInstance,
  ServiceRegistrationOptions,
  ServiceSummary,
  StoryIndexAccess,
  StoryInput,
  StoryTestResult,
  StoryTestResultHistory,
  StoryTestResultHistoryEntry,
  WorkerGatedStoryDocsProviderOptions,
  moduleGraphServiceDef,
} from 'storybook/internal/services';
export type {
  BuildStaticStandaloneOptions,
  HostValidationOptions,
  ManifestFeatures,
  ManifestStatus,
  SkillInputs,
  ToolAvailability,
} from 'storybook/internal/server';

export {
  MDX_SERVICE_ID,
  StoryIndexGenerator,
  Tag,
  analyzeMdx,
  buildIndex,
  buildIndexStandalone,
  experimental_loadStorybook,
  getComponentCandidates,
  getRefsFromConfig,
  getStoriesPathsFromConfig,
  loadManifests,
  mapStaticDir,
  mdxManifestRef,
  mdxQueryStaticPath,
  mdxStaticStorePath,
  runStoryTests,
} from 'storybook/internal/story-index';
export {
  ChangeDetectionFailureError,
  ChangeDetectionService,
  ChangeDetectionUnavailableError,
  analyzeTestResults,
  createDocsToolset,
  createLocalDocsAccess,
  createManifestDocsAccess,
  createServiceDocsAccess,
  createStoriesToolset,
  createWorkerGatedStoryDocsProvider,
  describeService,
  emptyManifests,
  experimental_MockUniversalStore,
  experimental_defineService,
  experimental_getChangeDetectionReadiness,
  experimental_getStatusStore,
  experimental_getTestProviderStore,
  experimental_registerService,
  experimental_resetChangeDetectionReadiness,
  experimental_resetServicesPresetOnce,
  experimental_setChangeDetectionHost,
  findStoryIds,
  getService,
  internal_UniversalStore,
  internal_fullStatusStore,
  internal_fullTestProviderStore,
  internal_universalStatusStore,
  internal_universalTestProviderStore,
  listServices,
  registerToolset,
  resolveChangeDetectionAdapter,
  reviewToolset,
  storyInputArraySchema,
  toStoryTestResult,
} from 'storybook/internal/services';
export {
  buildStaticStandalone,
  getBuilders,
  getEffectiveToolAvailability,
  getErrorLevel,
  getManifestStatus,
  getPreviewBodyTemplate,
  getPreviewHeadTemplate,
  getServerPort,
  getToolAvailability,
  isAddonA11yEnabled,
  isAddonVitestEnabled,
  isModuleGraphSupported,
  isValidHost,
  prepareHeadlessUniversalStores,
  resolveOnboardingInitialPath,
  resolveSkillInputs,
  sendTelemetryError,
  withTelemetry,
} from 'storybook/internal/server';

/**
 * Start the dev server, then exit the process when the smoke test finishes or a signal arrives.
 *
 * @deprecated Use `buildDevStandalone` from `storybook/internal/server`, which leaves exiting and
 * signal handling to the caller.
 */
export async function buildDevStandalone(
  options: Parameters<typeof buildDevStandaloneFromServer>[0]
): Promise<DevServer> {
  return exitLikeStandaloneDev(await buildDevStandaloneFromServer(options), options.smokeTest);
}

/**
 * Build Storybook in `dev`, `static` or `index` mode; `dev` exits like `buildDevStandalone`.
 *
 * @deprecated Use `build` from `storybook/internal/server`, which never exits the process.
 */
export async function build(
  options: Parameters<typeof buildFromServer>[0] = {},
  frameworkOptions: Parameters<typeof buildFromServer>[1] = {}
): ReturnType<typeof buildFromServer> {
  const result = await buildFromServer(options, frameworkOptions);
  if ((options.mode ?? 'dev') !== 'dev') {
    return result;
  }
  return exitLikeStandaloneDev(result as DevServer, { ...options, ...frameworkOptions }.smokeTest);
}

async function exitLikeStandaloneDev(server: DevServer, smokeTest?: boolean): Promise<DevServer> {
  if (smokeTest) {
    await server.close();
    process.exit(server.exitCode ?? 0);
  } else {
    exitOnDevServerSignal(server);
  }
  return server;
}
