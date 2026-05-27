import type {
  Commands,
  Queries,
  RuntimeService,
  ServiceDefinition,
  ServiceDescriptor,
  ServiceSummary,
} from './types.ts';

export type AnyServiceDefinition = ServiceDefinition<unknown, Queries<unknown>, Commands<unknown>>;

export type RegistryEntry = {
  definition: AnyServiceDefinition;
  runtime: RuntimeService;
  summary: ServiceSummary;
  descriptor: ServiceDescriptor;
};

/**
 * Module-local registry of running open-service instances, keyed by `definition.id`.
 *
 * Living in its own module mirrors the `UniversalStore` pattern in this codebase: tests can mock
 * this file directly to swap the registry, and there is no `globalThis` slot to collide across
 * Storybook versions in the same process.
 */
export const instances: Map<string, RegistryEntry> = new Map();
