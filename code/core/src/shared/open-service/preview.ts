/**
 * Preview-side entrypoint for the open-service architecture.
 *
 * Import from here in preview (renderer) code. This entrypoint is intentionally renderer-agnostic —
 * it exposes the raw service API with no React dependencies. Use `.subscribe()` directly to react to
 * state changes in your renderer.
 *
 * The manager entrypoint (`./manager.ts`) additionally exports `useServiceQuery` and
 * `useServiceCommand` for React-based manager code.
 *
 * Quick start:
 *
 * ```ts
 * import { registerService } from 'storybook/internal/open-service/preview';
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

export { defineService } from './service-definition.ts';

export { clearRegistry, serviceRegistryApi, unregisterService } from './service-registry.ts';

export {
  generateClientId,
  getServiceChannel,
  SERVICE_COMMAND_ERROR,
  SERVICE_COMMAND_INVOKE,
  SERVICE_COMMAND_RESULT,
  SERVICE_PATCHES,
  SERVICE_WELCOME_REPLY,
  SERVICE_WELCOME_REQUEST,
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

/**
 * Registers a service in the preview and returns its runtime surface.
 *
 * The preview is a leaf (`relay: false`): with a single channel transport there is nothing to
 * forward. The channel is read from `globalThis.__STORYBOOK_ADDONS_CHANNEL__`, which both builders
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
