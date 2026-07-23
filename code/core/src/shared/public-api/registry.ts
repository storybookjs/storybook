import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { AnyApiDefinition, ApiInvocationContext, ApiMethod } from './definition.ts';

const registry = new Map<string, AnyApiDefinition>();

export function registerPublicApi(definitions: readonly AnyApiDefinition[]): void {
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
  const registeredDefinition = registry.get(definition.id);

  if (!registeredDefinition) {
    throw new TypeError(`No public API with id "${definition.id}" is registered.`);
  }

  return registeredDefinition as TDefinition;
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
  registry.clear();
}

async function validateInput<TSchema extends StandardSchemaV1<unknown, unknown>>(
  schema: TSchema,
  input: unknown
): Promise<StandardSchemaV1.InferOutput<TSchema>> {
  const result = await schema['~standard'].validate(input);

  if (result.issues) {
    throw new TypeError('Public API input validation failed.');
  }

  return result.value;
}
