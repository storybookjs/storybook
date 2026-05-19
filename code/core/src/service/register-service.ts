import { instances } from './instances.ts';
import { ServiceRuntime } from './service-runtime.ts';
import type { ServiceDefinition, ServiceRegistration, ServiceStore } from './types.ts';

/**
 * Public-only view of a runtime. Returns the runtime's stable `publicStore` reference, which
 * was built once at construction and omits the infrastructure-facing methods (getState,
 * setState, subscribe, getLastPatches). Application code only sees what it should: id,
 * definition, queries, commands.
 */
function asServiceStore<TDef extends ServiceDefinition<any, any, any, any>>(
  runtime: ServiceRuntime<TDef>
): ServiceStore<TDef> {
  return runtime.publicStore as unknown as ServiceStore<TDef>;
}

/**
 * Register a service definition with the global runtime.
 *
 * `registration` provides handlers for any abstract commands declared in the definition, and
 * can override concrete handlers if the same definition is used in multiple environments.
 *
 * Idempotent on the same `definition` reference: calling twice returns the same `ServiceStore`.
 * If a different definition is registered against an existing id, this throws — the
 * registry is global and definitions must be consistent across imports.
 *
 * If an abstract command is declared in the definition but no handler is supplied at
 * registration, this throws with an actionable error message.
 */
export function registerService<TDef extends ServiceDefinition<any, any, any, any>>(
  definition: TDef,
  registration?: ServiceRegistration<TDef>
): ServiceStore<TDef> {
  const existing = instances.get(definition.id);
  if (existing) {
    if (existing.definition !== definition) {
      throw new Error(
        `[service] A different service definition is already registered for id "${definition.id}". ` +
          `Service definitions must be singletons across the bundle.`
      );
    }
    return asServiceStore(existing) as ServiceStore<TDef>;
  }
  const runtime = new ServiceRuntime(definition, registration);
  instances.set(definition.id, runtime);
  return asServiceStore(runtime);
}

/**
 * Look up a previously-registered service. Pass the definition for type safety, or just the id
 * if you don't have the definition in scope (return type widens to `ServiceStore<any>`).
 *
 * Throws if no service is registered for the given id.
 */
export function getService<TDef extends ServiceDefinition<any, any, any, any>>(
  definition: TDef
): ServiceStore<TDef>;
export function getService(id: string): ServiceStore<ServiceDefinition<any, any, any, any>>;
export function getService(arg: string | ServiceDefinition<any, any, any, any>): ServiceStore<any> {
  const id = typeof arg === 'string' ? arg : arg.id;
  const runtime = instances.get(id);
  if (!runtime) {
    throw new Error(
      `[service] No service is registered for id "${id}". Did you forget to call registerService?`
    );
  }
  return asServiceStore(runtime);
}

/** Test-only helper. Clear the global registry. */
export function __resetServiceRegistry(): void {
  instances.clear();
}
