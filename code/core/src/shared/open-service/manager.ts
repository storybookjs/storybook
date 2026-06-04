/**
 * Manager-side entrypoint for the open-service architecture.
 *
 * Import from here in manager (React) code. Define services with `storybook/open-service`.
 *
 * Quick start:
 *
 * ```ts
 * import { registerService, useServiceQuery, useServiceCommand } from 'storybook/manager-api';
 *
 * // Inside an addons.register callback:
 * const service = registerService(myServiceDef);
 *
 * function MyTool() {
 *   const value = useServiceQuery(service, 'getValue');
 *   const setValue = useServiceCommand(service, 'setValue');
 *   return <button onClick={() => setValue({ value: 'new' })}>{value}</button>;
 * }
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

export { useServiceCommand } from './use-service-command.ts';
export { useServiceQuery } from './use-service-query.ts';

/**
 * Registers a service in the manager and returns its runtime surface.
 *
 * The manager is a relay hub: it bridges the dev server and the preview iframes. The channel is read
 * via `getChannel()` from `storybook/internal/channels`, which the manager runtime installs before any
 * `addons.register` callback runs, so no manual channel setup is needed.
 */
export function registerService<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  definition: ServiceDefinition<TState, TQueries, TCommands>,
  registration?: ServiceRegistrationOptions<TState, TQueries, TCommands>
): ServiceInstance<TState, TQueries, TCommands> & ServiceRegistryApi {
  return registerServiceCore(definition, registration, { relay: true });
}
