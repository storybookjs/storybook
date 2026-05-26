/**
 * Open Service Architecture — public entry point.
 *
 * Conceptual overview (see `./README.md` for the long version):
 *   - `defineService<S>()(({ query, command }) => ({ state, queries, commands }))` declares a
 *     service. Schema-driven inference covers definition handlers; the runtime validates
 *     `input` / `output` on every call.
 *   - `registerService(def, registration?)` activates the definition and returns a
 *     `ServiceStore`. Idempotent on the definition; safe to call from multiple modules.
 *   - `getService(def|id)` looks up an already-registered service.
 *   - `buildServiceArtifacts(def)` writes the per-input JSON files used by the static-build
 *     loader; `setStaticTransport(...)` installs the loader on the client.
 *
 * Commands come in two flavours: **concrete** (definition supplies the `handler`, registration
 * cannot override) and **abstract** (no `handler` on the definition; registration MAY supply
 * one — same definition typically registered in multiple runtimes).
 *
 * Schemas are required: every query/command declares Standard Schema v1 `input` and `output`.
 * The runtime validates at the boundary; `ServiceValidationError` is thrown on mismatch.
 *
 * State is private to the service. Read it via queries; change it via commands.
 */

export { buildServiceArtifacts } from './build-artifacts.ts';
export {
  SERVICE_EVENT_PREFIX,
  SERVICE_PATCHES,
  SERVICE_WELCOME_REPLY,
  SERVICE_WELCOME_REQUEST,
  clearServiceChannel,
  setServiceChannel,
  type PatchesPayload,
  type ServiceChannel,
  type WelcomeReplyPayload,
  type WelcomeRequestPayload,
} from './channel-transport.ts';
export { command, defineService, query } from './define-service.ts';
export { __resetServiceRegistry, getService, registerService } from './register-service.ts';
export { ServiceRuntime, createService } from './service-runtime.ts';
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
  CommandOverrides,
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
  ServiceInstance,
  ServiceRegistration,
  ServiceStaticTransport,
  ServiceStore,
  StateMutator,
} from './types.ts';
