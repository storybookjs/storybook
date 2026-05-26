/**
 * Open Service Architecture — public entry point.
 *
 * Conceptual overview (see `./README.md` for the long version):
 *   - `defineService<S>()(({ query, command }) => ({ state, queries, commands }))` declares a
 *     service. Schema-driven inference covers definition handlers; the runtime validates
 *     `input` / `output` on every call.
 *   - `createService(def)` builds a fresh runtime instance from the definition.
 *   - `getService(def)` looks up (or lazily creates) a singleton instance.
 *   - `buildServiceArtifacts(def)` writes the per-input JSON files used by the static-build
 *     loader; `setStaticTransport(...)` installs the loader on the client.
 *
 * Schemas are required: every query/command declares Standard Schema v1 `input` and `output`.
 * The runtime validates at the boundary; `ServiceValidationError` is thrown on mismatch.
 *
 * State is private to the service. Read it via queries; change it via commands.
 */

export { buildServiceArtifacts } from './build-artifacts.ts';
export { command, defineService, query } from './define-service.ts';
export { ServiceRuntime, clearRegistry, createService, getService } from './service-runtime.ts';
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

export type {
  AnyCommandDef,
  AnyQueryDef,
  AnySchema,
  BuildCtx,
  CommandDef,
  CommandHandlerFn,
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
  ServiceStaticTransport,
  StateMutator,
} from './types.ts';
