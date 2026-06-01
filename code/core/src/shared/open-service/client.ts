/**
 * Client-side entrypoint for the open-service architecture.
 *
 * Import from here in manager and preview code. The server-side entrypoint is
 * `./server.ts`, which re-exports registration helpers and static snapshot building for
 * the Node.js side.
 *
 * Quick start:
 *
 * ```ts
 * // Entry point (manager or preview):
 * import { setServiceChannel } from 'storybook/internal/open-service/client';
 * setServiceChannel(addons.getChannel());
 *
 * // Service consumer:
 * import { registerServiceClient, useServiceQuery, useServiceCommand } from '...';
 * const service = registerServiceClient(myServiceDef);
 * ```
 */

export { defineService } from './service-definition.ts';

export {
  clearClientRegistry,
  clientRegistryApi,
  registerServiceClient,
  unregisterServiceClient,
} from './service-client.ts';

export {
  clearServiceChannel,
  generateClientId,
  getServiceChannel,
  SERVICE_COMMAND_ERROR,
  SERVICE_COMMAND_INVOKE,
  SERVICE_COMMAND_RESULT,
  SERVICE_PATCHES,
  SERVICE_WELCOME_REPLY,
  SERVICE_WELCOME_REQUEST,
  setServiceChannel,
} from './service-channel.ts';
export type {
  CommandErrorPayload,
  CommandInvokePayload,
  CommandResultPayload,
  PatchesPayload,
  ServiceChannel,
  WelcomeReplyPayload,
  WelcomeRequestPayload,
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
