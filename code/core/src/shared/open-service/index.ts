/**
 * Public API for the open-service system.
 *
 * This barrel intentionally exposes only the authoring and runtime entry points that callers
 * outside this directory should rely on. Tests and internal modules can import implementation
 * files directly without widening the supported public surface.
 */
export { defineCommand, defineQuery, defineService } from './service-definition.ts';

export { buildStaticFiles } from './static-build.ts';
export { createService } from './service-runtime.ts';

export type {
  CommandCtx,
  CommandDefinition,
  Command,
  CreateServiceOptions,
  Query,
  QueryCtx,
  QueryDefinition,
  ServiceDefinition,
  ServiceInstance,
  StaticStore,
} from './types.ts';
