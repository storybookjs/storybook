/**
 * Public API for the open-service system.
 *
 * This barrel intentionally exposes only the authoring and runtime entry points that callers
 * outside this directory should rely on. Tests and internal modules can import implementation
 * files directly without widening the supported public surface.
 */
export { defineService } from './service-definition.ts';

export type {
  CommandCtx,
  CommandDefinition,
  Command,
  OperationDescriptor,
  Query,
  QueryCtx,
  QueryDefinition,
  RuntimeService,
  SchemaDescriptor,
  ServiceDefinition,
  ServiceDescriptor,
  ServiceId,
  ServiceInstance,
  ServiceRegistrationOptions,
  ServiceSummary,
  ServerServiceRegistration,
  StaticStore,
} from './types.ts';
