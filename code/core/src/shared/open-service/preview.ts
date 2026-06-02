/**
 * Preview-side entrypoint for the open-service architecture.
 *
 * Import from here in preview (renderer) code. This entrypoint is intentionally
 * renderer-agnostic — it exposes the raw service API with no React dependencies.
 * Use `.subscribe()` directly to react to state changes in your renderer.
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

import { addons } from 'storybook/preview-api';

import { registerServiceClient } from './service-client.ts';
import { getServiceChannel, setServiceChannel } from './service-channel.ts';
import type {
  Commands,
  Queries,
  ServiceDefinition,
  ServiceInstance,
  ServiceRegistrationOptions,
  ServiceRegistryApi,
} from './types.ts';

export { defineService } from './service-definition.ts';

export {
  clearClientRegistry,
  clientRegistryApi,
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
 * Automatically wires the preview channel (`addons.getChannel()`) on first call so callers
 * never need to manage the channel directly.
 */
export function registerService<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  definition: ServiceDefinition<TState, TQueries, TCommands>,
  registration?: ServiceRegistrationOptions<TState, TQueries, TCommands>
): ServiceInstance<TState, TQueries, TCommands> & ServiceRegistryApi {
  if (!getServiceChannel()) {
    setServiceChannel(addons.getChannel());
  }
  // The preview is a leaf: its channel has a single transport (to the manager), so it has nothing to
  // relay and keeps the default `relay: false`. The manager and dev server are the relay hubs.
  return registerServiceClient(definition, registration);
}
