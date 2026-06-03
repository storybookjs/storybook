/**
 * Client-side entrypoint for the open-service architecture.
 *
 * Import from here in browser code that wants the renderer-agnostic registration + channel surface
 * directly. Manager (React) code should prefer `./manager.ts` and preview code `./preview.ts` — both
 * bake in the correct relay role and delegate to the same unified registry as this barrel.
 *
 * Quick start:
 *
 * ```ts
 * import { registerService, useServiceQuery, useServiceCommand } from '...';
 * const service = registerService(myServiceDef);
 * ```
 *
 * The channel is read from `globalThis.__STORYBOOK_ADDONS_CHANNEL__` — the manager installs it and
 * both builders inject it into the preview iframe, so there is no manual channel setup.
 */

export { defineService } from './service-definition.ts';

export {
  clearRegistry,
  registerService,
  serviceRegistryApi,
  unregisterService,
} from './service-registry.ts';

export {
  clearServiceChannel,
  generateClientId,
  getServiceChannel,
  installNoopServiceChannel,
  setServiceChannel,
  SERVICE_COMMAND_ERROR,
  SERVICE_COMMAND_INVOKE,
  SERVICE_COMMAND_RESULT,
  SERVICE_PATCHES,
  SERVICE_SYNC_START,
  SERVICE_SYNC_START_REPLY,
} from './service-channel.ts';
export type {
  CommandErrorPayload,
  CommandInvokePayload,
  CommandResultPayload,
  PatchesPayload,
  ServiceChannel,
  SyncStartPayload,
  SyncStartReplyPayload,
} from './service-channel.ts';

export { useServiceCommand } from './use-service-command.ts';
export { useServiceQuery } from './use-service-query.ts';

export type {
  AnyServiceDefinition,
  Command,
  CommandCtx,
  CommandDefinition,
  CommandSelf,
  LoadCtx,
  LoadSelf,
  OperationDescriptor,
  Query,
  QueryCtx,
  QueryDefinition,
  QuerySelf,
  RuntimeService,
  SchemaDescriptor,
  ServerServiceRegistration,
  ServiceDefinition,
  ServiceDescriptor,
  ServiceId,
  ServiceInstance,
  ServiceInstanceOf,
  ServiceRegistrationOptions,
  ServiceSummary,
  StaticStore,
} from './types.ts';
