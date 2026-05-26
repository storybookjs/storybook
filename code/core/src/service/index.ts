/**
 * Open Service Architecture — public entry point.
 *
 * Conceptual overview (see `./CONCEPTS.md` for the long version):
 *   - `defineService<S>()(({ query, command }) => ({ state, queries, commands }))` declares a
 *     service (recommended). Schema-driven inference covers definition handlers and registration
 *     overrides; a command without `handler` is **abstract** and must be supplied at registration.
 *   - `registerService(def, { commands: { … } })` activates a service. Supplies handlers for
 *     any abstract commands; concrete commands are owned by the definition and cannot be
 *     overridden here.
 *   - `getService(defOrId)` looks up an already-registered service.
 *   - `useServiceQuery(store, name, input?)` subscribes a React component to a query.
 *
 * Schemas are required: every query/command declares Standard Schema v1 `input` and `output`.
 * The runtime validates at the boundary; `ServiceValidationError` is thrown on mismatch.
 *
 * State is private to the service. Read it via queries; change it via commands.
 */

export { buildServiceArtifacts } from './build-artifacts.ts';
export {
  clearServiceChannel,
  setServiceChannel,
  type ServiceChannel,
} from './channel-transport.ts';
export { command, defineService, query } from './define-service.ts';
export { getService, registerService } from './register-service.ts';
export { ServiceRuntime } from './service-runtime.ts';
export {
  ServiceValidationError,
  type ValidationKind,
  type ValidationPhase,
} from './service-validation.ts';
export {
  clearStaticTransport,
  createBrowserStaticTransport,
  setStaticTransport,
} from './static-transport.ts';
export { useServiceQuery } from './use-service-query.ts';

export type {
  AbstractCommandDef,
  AnyCommandDef,
  AnyQueryDef,
  AnySchema,
  BuildCtx,
  CommandDef,
  CommandHandlerFn,
  ConcreteCommandDef,
  InferSchemaInput,
  InferSchemaOutput,
  InputOfCommand,
  InputOfQuery,
  OutputOfCommand,
  OutputOfQuery,
  QueryDef,
  ServiceCtx,
  ServiceDefinition,
  ServiceRegistration,
  ServiceStaticTransport,
  ServiceStore,
  StateMutator,
} from './types.ts';
