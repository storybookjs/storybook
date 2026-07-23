import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { AnyApiDefinition, ApiInvocationContext, ApiMethod } from './definition.ts';

const REGISTRY_SYMBOL = Symbol.for('storybook.public-api.registry');

/**
 * Returns the realm-global registry backing public API registration.
 *
 * Anchored on a `globalThis` symbol slot (mirroring the open-service registry) so every module in
 * one realm shares a single map even when this file is reached through different import paths.
 * Lazily created so importing the module does not eagerly mutate global state.
 */
function getRegistry(): Map<string, AnyApiDefinition> {
  const registryGlobal = globalThis as {
    [key: symbol]: Map<string, AnyApiDefinition> | undefined;
  };

  registryGlobal[REGISTRY_SYMBOL] ??= new Map<string, AnyApiDefinition>();

  return registryGlobal[REGISTRY_SYMBOL];
}

/**
 * Registers fully constructed API definitions in the realm-global registry.
 *
 * Idempotent by definition identity: re-registering the exact same definition object is a no-op,
 * but a different definition reusing a registered id throws. Public API factories (e.g.
 * `registerReviewApi`) build a fresh definition per call, so they must run once per realm — the
 * `services` preset enforces this via its `STORYBOOK_SERVICES_LOADED` guard. Repeated registration
 * with a fresh factory is intentionally rejected rather than silently replacing a possibly
 * conflicting definition, because equality of closures/handlers cannot be verified safely.
 */
export function registerPublicApi(definitions: readonly AnyApiDefinition[]): void {
  const registry = getRegistry();
  for (const definition of definitions) {
    const registeredDefinition = registry.get(definition.id);

    if (registeredDefinition && registeredDefinition !== definition) {
      throw new TypeError(`A public API with id "${definition.id}" is already registered.`);
    }

    registry.set(definition.id, definition);
  }
}

export function publicApi<TDefinition extends AnyApiDefinition>(
  definition: TDefinition
): TDefinition {
  const registeredDefinition = getRegistry().get(definition.id);

  if (registeredDefinition !== definition) {
    throw new TypeError(
      `The supplied public API definition for "${definition.id}" is not registered.`
    );
  }

  return definition;
}

export async function invokeApi<
  TDefinition extends AnyApiDefinition,
  TMethodName extends string & keyof TDefinition['methods'],
>(
  definition: TDefinition,
  methodName: TMethodName,
  input: unknown,
  context: ApiInvocationContext = {}
): Promise<Awaited<ReturnType<TDefinition['methods'][TMethodName]['handler']>>> {
  const method = definition.methods[methodName] as ApiMethod;
  const parsedInput = await validateInput(method.schema, input);

  return method.handler(parsedInput, context) as Promise<
    Awaited<ReturnType<TDefinition['methods'][TMethodName]['handler']>>
  >;
}

export function clearPublicApiRegistry(): void {
  getRegistry().clear();
}

async function validateInput<TSchema extends StandardSchemaV1<unknown, unknown>>(
  schema: TSchema,
  input: unknown
): Promise<StandardSchemaV1.InferOutput<TSchema>> {
  const result = await schema['~standard'].validate(input);

  if (result.issues) {
    throw new TypeError(`Public API input validation failed. ${formatIssues(result.issues)}`);
  }

  return result.value;
}

/** Renders Standard Schema issues into an actionable `path: message` summary. */
function formatIssues(issues: ReadonlyArray<StandardSchemaV1.Issue>): string {
  return issues
    .map((issue) => {
      const path = issue.path
        ?.map((segment) =>
          typeof segment === 'object' && segment !== null ? segment.key : segment
        )
        .join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}
