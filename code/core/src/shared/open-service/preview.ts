/**
 * Preview-side entrypoint for the open-service architecture.
 *
 * Import from here in preview (renderer) code. This entrypoint is intentionally renderer-agnostic —
 * it exposes only registration with no React dependencies. Use `.subscribe()` on queries to react
 * to state changes in your renderer.
 *
 * Define services with `storybook/open-service`. The manager entrypoint (`./manager.ts`) adds
 * `useServiceQuery` and `useServiceCommand` on top of relay registration.
 *
 * Quick start:
 *
 * ```ts
 * import { registerService } from 'storybook/preview-api';
 *
 * const service = registerService(myServiceDef);
 *
 * service.queries.getColor.subscribe(undefined, (color) => {
 *   document.body.style.background = color;
 * });
 * ```
 */

import { registerService as registerServiceCore } from './service-registry.ts';
import type {
  Commands,
  Queries,
  ServiceDefinition,
  ServiceInstance,
  ServiceRegistrationOptions,
  ServiceRegistryApi,
} from './types.ts';

/**
 * Registers a service in the preview and returns its runtime surface.
 *
 * The preview is a leaf (`relay: false`): with a single channel transport there is nothing to
 * forward. The channel is read via `getChannel()` from `storybook/internal/channels`, which both builders
 * inject into the iframe, so no manual channel setup is needed.
 */
export function registerService<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  definition: ServiceDefinition<TState, TQueries, TCommands>,
  registration?: ServiceRegistrationOptions<TState, TQueries, TCommands>
): ServiceInstance<TState, TQueries, TCommands> & ServiceRegistryApi {
  return registerServiceCore(definition, registration);
}
