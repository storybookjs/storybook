/**
 * Environment-agnostic open-service API (`storybook/open-service`).
 *
 * Use this entrypoint for shared service definitions imported by manager, preview, and server.
 * Registration and hooks live on `storybook/manager-api`, `storybook/preview-api`, and server APIs.
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
  ServiceSummary,
  StaticStore,
} from './types.ts';
