/**
 * Public API for the open-service system.
 *
 * This barrel intentionally exposes only the authoring and runtime entry points that callers
 * outside this directory should rely on. Tests and internal modules can import implementation
 * files directly without widening the supported public surface.
 */
export { defineService } from './service-definition.ts';

export type {
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
  ServiceRegistrationOptions,
  ServiceSummary,
  StaticStore,
} from './types.ts';
