/**
 * Environment-agnostic open-service API (`storybook/open-service`).
 *
 * Use this entrypoint for shared service definitions imported by manager, preview, and server.
 * Register in the manager with `storybook/manager-api` (hooks), in preview with `storybook/preview-api`,
 * or on the server via core-server experimental APIs.
 */
export { defineService } from './service-definition.ts';
export { seedQueryState } from './query-state.ts';

export type { DocgenService } from './services/docgen/definition.ts';
export type { DocgenPayload } from './services/docgen/types.ts';
export type { StoryDocsService } from './services/story-docs/definition.ts';
export {
  prependImportToSnippet,
  selectSnippetForStory,
  selectStoryDoc,
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
