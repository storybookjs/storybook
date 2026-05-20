/**
 * Open Service Architecture — public entry point.
 *
 * Conceptual overview (see `./CONCEPTS.md` for the long version):
 *   - `defineService({ state, queries, commands, load })` declares a service.
 *   - `defineCommand<TInput>()` declares an abstract command — implementation provided at registration.
 *   - `defineCommand(handler)` wraps a concrete command (or just put the function in the commands map).
 *   - `defineLoader(handler, enumerateInputs, options)` declares a loader (statically buildable).
 *   - `registerService(def, { commands: { … } })` activates a service. Provides any abstract command bodies.
 *   - `getService(defOrId)` looks up an already-registered service.
 *   - `useServiceQuery(store, name, input?)` subscribes a React component to a query.
 *
 * State is private to the service. Read it via queries; change it via commands.
 */

export { buildServiceArtifacts } from './build-artifacts.ts';
export { defineCommand, defineLoader, defineQuery, defineService } from './define-service.ts';
export { getService, registerService } from './register-service.ts';
export { ServiceRuntime } from './service-runtime.ts';
export {
  clearStaticTransport,
  createBrowserStaticTransport,
  setStaticTransport,
} from './static-transport.ts';
export { useServiceQuery } from './use-service-query.ts';

export type {
  AbstractCommand,
  BuildCtx,
  InputOfCommand,
  InputOfLoader,
  InputOfQuery,
  LoaderDefinition,
  LoaderOptions,
  OutputOfQuery,
  QueryDef,
  QueryEntry,
  ServiceCtx,
  ServiceDefinition,
  ServiceRegistration,
  ServiceStaticTransport,
  ServiceStore,
  StateMutator,
} from './types.ts';
