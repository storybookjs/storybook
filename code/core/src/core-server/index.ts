/// <reference path="./typings.d.ts" />

export { getPreviewHeadTemplate, getPreviewBodyTemplate } from 'storybook/internal/common';

export * from './build-static.ts';
export * from './build-dev.ts';
export * from './build-index.ts';
export * from './withTelemetry.ts';
export { default as build } from './standalone.ts';
export { mapStaticDir } from './utils/server-statics.ts';
export { StoryIndexGenerator } from './utils/StoryIndexGenerator.ts';
export { getStoriesPathsFromConfig } from './utils/get-stories-paths-from-config.ts';
export { generateStoryFile } from './utils/generate-story.ts';
export type { GenerateStoryResult, GenerateStoryOptions } from './utils/generate-story.ts';
export type { ComponentArgTypesData } from './utils/get-dummy-args-from-argtypes.ts';

export { loadStorybook as experimental_loadStorybook } from './load.ts';

export { Tag } from '../shared/constants/tags.ts';
export { analyzeMdx } from './utils/analyze-mdx.ts';
export {
  MDX_SERVICE_ID,
  mdxQueryStaticPath,
  mdxStaticStorePath,
  mdxManifestRef,
} from './utils/manifests/mdx-manifest.ts';
export type {
  DocsManifestEntry,
  DocsManifestRefEntry,
  JsonRef,
  MdxDocPayload,
  MdxError,
  MdxPayload,
  MdxServiceContract,
} from './utils/manifests/mdx-manifest.ts';
export { defineService as experimental_defineService } from '../shared/open-service/index.ts';
export type {
  Command,
  CommandCtx,
  CommandDefinition,
  OperationDescriptor,
  Query,
  QueryCtx,
  QueryDefinition,
  RuntimeService,
  SchemaDescriptor,
  ServiceDefinition,
  ServiceDescriptor,
  ServiceInstance,
  ServiceRegistrationOptions,
  ServiceSummary,
  ServerServiceRegistration,
} from '../shared/open-service/index.ts';
export {
  describeService,
  getService,
  listServices,
  registerService as experimental_registerService,
} from '../shared/open-service/server.ts';

/**
 * Toolset registration and server-side primitives for addons that host a public toolset.
 */
export { registerToolset } from '../shared/open-service/toolset-registry.ts';
export type { StoryIndexAccess } from '../shared/open-service/toolsets/stories/definition.ts';
export {
  findStoryIds,
  type FoundStory,
  type NotFoundStory,
} from '../shared/open-service/toolsets/stories/find-story-ids.ts';
export {
  storyInputArraySchema,
  type StoryInput,
} from '../shared/open-service/toolsets/stories/story-input.ts';
export { createDocsToolset } from '../shared/open-service/toolsets/docs/definition.ts';
export { emptyManifests } from '../shared/open-service/toolsets/docs/access.ts';
export type { DocsAccess, ResolvedDocsEntry } from '../shared/open-service/toolsets/docs/access.ts';
export { createServiceDocsAccess } from '../shared/open-service/toolsets/docs/access-service.ts';
export { createManifestDocsAccess } from '../shared/open-service/toolsets/docs/access-manifest.ts';
export { createLocalDocsAccess } from '../shared/open-service/toolsets/docs/access-local.ts';
export { loadManifests } from './utils/manifests/manifests.ts';
export { createStoriesToolset } from '../shared/open-service/toolsets/stories/definition.ts';
export type { PreviewStoriesOutput } from '../shared/open-service/toolsets/stories/definition.ts';
export { reviewToolset } from '../shared/open-service/toolsets/review/definition.ts';

export { UniversalStore as experimental_UniversalStore } from '../shared/universal-store/index.ts';
export { MockUniversalStore as experimental_MockUniversalStore } from '../shared/universal-store/mock.ts';
export {
  getStatusStoreByTypeId as experimental_getStatusStore,
  fullStatusStore as internal_fullStatusStore,
  universalStatusStore as internal_universalStatusStore,
} from './stores/status.ts';
export {
  ChangeDetectionFailureError,
  ChangeDetectionUnavailableError,
} from './change-detection/errors.ts';
export {
  getChangeDetectionReadiness as experimental_getChangeDetectionReadiness,
  setChangeDetectionHost as experimental_setChangeDetectionHost,
  resetChangeDetectionReadiness as experimental_resetChangeDetectionReadiness,
  type ChangeDetectionReadiness as Experimental_ChangeDetectionReadiness,
} from './change-detection/readiness.ts';
export type {
  ChangeDetectionAdapter,
  FileChangeEvent,
  ModuleResolveConfig,
} from '../shared/open-service/services/module-graph/engine/adapters/types.ts';
export type {
  moduleGraphServiceDef,
  ModuleGraphService,
} from '../shared/open-service/services/module-graph/definition.ts';
export type {
  ImportEdge,
  ImportParser,
  ImportParserContext,
  ParseFileArgs,
} from '../shared/open-service/services/module-graph/engine/parser-registry/types.ts';
export { ChangeDetectionService } from './change-detection/change-detection-service.ts';
export { resolveChangeDetectionAdapter } from '../shared/open-service/services/module-graph/server.ts';
export { getBuilders } from './utils/get-builders.ts';
export { prepareHeadlessUniversalStores } from './utils/get-server-channel.ts';
export { resetServicesPresetOnce as experimental_resetServicesPresetOnce } from './utils/apply-services-preset-once.ts';
export {
  getTestProviderStoreById as experimental_getTestProviderStore,
  fullTestProviderStore as internal_fullTestProviderStore,
  universalTestProviderStore as internal_universalTestProviderStore,
} from './stores/test-provider.ts';

export { getComponentCandidates } from './utils/ghost-stories/get-candidates.ts';
export { runStoryTests } from './utils/ghost-stories/run-story-tests.ts';
export { getServerPort } from './utils/server-address.ts';

/**
 * Shared availability probing for skill-content assembly: the single source of truth for the
 * runtime gates that decide whether a tool is registered/badged, consumed by the skills CLI and
 * addon-mcp so the two channels cannot drift.
 */
export {
  getEffectiveToolAvailability,
  getToolAvailability,
  isModuleGraphSupported,
  isModuleGraphSupportedByBuilder,
} from '../cli/skills/availability.ts';
export type { GetToolAvailabilityOptions, ToolAvailability } from '../cli/skills/availability.ts';
export { isAddonA11yEnabled } from '../cli/skills/addon-a11y.ts';
export { isAddonVitestEnabled } from '../cli/skills/addon-vitest.ts';
export { resolveSkillInputs } from '../cli/skills/inputs.ts';
export type { SkillInputs } from '../cli/skills/inputs.ts';
export { getManifestStatus } from '../cli/skills/manifest-status.ts';
export type { ManifestFeatures, ManifestStatus } from '../cli/skills/manifest-status.ts';
export { getReviewStatus } from '../cli/skills/review-status.ts';
export type { GetReviewStatusOptions, ReviewStatus } from '../cli/skills/review-status.ts';

export { analyzeTestResults } from '../shared/utils/analyze-test-results.ts';
export type {
  StoryTestResult,
  StoryTestResultHistory,
  StoryTestResultHistoryEntry,
} from '../shared/utils/test-result-types.ts';
export { toStoryTestResult } from '../shared/utils/to-story-test-result.ts';
