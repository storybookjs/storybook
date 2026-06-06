/**
 * Environment-agnostic open-service API (`storybook/open-service`).
 *
 * Use this entrypoint for shared service definitions imported by manager, preview, and server.
 * Register in the manager with `storybook/manager-api` (hooks), in preview with `storybook/preview-api`,
 * or on the server via core-server experimental APIs.
 */
export { defineService } from './service-definition.ts';

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
  ServiceState,
  ServiceSummary,
  StaticStore,
} from './types.ts';
