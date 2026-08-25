/**
 * Environment-agnostic open-service API (`storybook/open-service`).
 *
 * Use this entrypoint for shared service definitions imported by manager, preview, and server.
 * Register in the manager with `storybook/manager-api` (hooks), in preview with `storybook/preview-api`,
 * or on the server via core-server experimental APIs.
 */
export { defineService } from './service-definition.ts';
export { seedQueryState } from './query-state.ts';

export {
  defineToolset,
  reportToolsetTelemetry,
  resolveToolsetDescription,
} from './toolset-definition.ts';
export type {
  AnyToolsetDefinition,
  AnyToolsetOutcome,
  ToolsetCtx,
  ToolsetDefinition,
  ToolsetGetService,
  ToolsetMethod,
  ToolsetMethodDescription,
  ToolsetObjectOutputSchema,
  ToolsetOutcome,
  ToolsetTelemetry,
  ToolsetTransport,
} from './toolset-definition.ts';
export { getToolName, parseToolsetMethodId, toMcpToolName } from './toolset-names.ts';
export type { ToolsetMethodId } from './toolset-names.ts';
export {
  clearToolsetRegistry,
  getRegisteredToolsets,
  getToolset,
  registerToolset,
} from './toolset-registry.ts';
// The errors the registry functions above throw. Catchers must import them from this same entry:
// each core entry bundles its own copy of a class, so an error class imported from another entry
// is a different constructor and `instanceof` silently fails.
export {
  OpenServiceDuplicateToolNameError,
  OpenServiceDuplicateToolsetError,
  OpenServiceInvalidToolsetMethodIdError,
  OpenServiceMissingToolsetError,
} from '../../server-errors.ts';
export type { KnownToolsets } from './toolset-types.ts';

export type { DocgenService } from './services/docgen/definition.ts';
export type { DocgenPayload } from './services/docgen/types.ts';
export type { StoryDocsService } from './services/story-docs/definition.ts';
export {
  prependImportToSnippet,
  selectSnippetForStory,
  selectStoryDoc,
  selectWarningForStory,
} from './services/story-docs/snippet.ts';

export type {
  AnyServiceDefinition,
  Command,
  CommandCtx,
  CommandDefinition,
  CommandSelf,
  LoadCtx,
  LoadSelf,
  LoadStatus,
  OperationDescriptor,
  Query,
  QueryCtx,
  QueryDefinition,
  QueryFunctions,
  QuerySelf,
  QueryState,
  QueryStatus,
  RuntimeService,
  SchemaDescriptor,
  ServerServiceRegistration,
  ServiceDefinition,
  ServiceDescriptor,
  ServiceId,
  ServiceInstance,
  ServiceInstanceOf,
  ServiceRegistrationOptions,
  ServiceRegistryApi,
  ServiceState,
  ServiceSummary,
  StaticStore,
} from './types.ts';
