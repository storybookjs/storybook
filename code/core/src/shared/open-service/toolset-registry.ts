import { bindToInstance, getInstanceContext } from '../instance-context.ts';

import {
  OpenServiceDuplicateToolNameError,
  OpenServiceDuplicateToolsetError,
  OpenServiceInvalidToolsetMethodIdError,
  OpenServiceMissingToolsetError,
  StorybookInstanceUnavailableError,
} from '../../server-errors.ts';
import type { AnyToolsetDefinition } from './toolset-definition.ts';
import type { KnownToolsets } from './toolset-types.ts';
import { toCliMethodName, toMcpToolName } from './toolset-names.ts';

// A symbol, not a module value, so every core bundle in the process finds the same slot on the context.
const TOOLSET_REGISTRY_KEY = Symbol.for('storybook.open-service.toolset-registry');

/**
 * Registers one public toolset on the current Storybook instance.
 *
 * Call it from the same place the paired OSA service registers (for core, the `services` preset
 * hook). Throws outside an instance.
 *
 * Unlike `registerService`, a repeated id throws instead of being ignored: services re-register
 * legitimately (HMR, repeated composition), while every toolset registration site is a one-shot
 * preset hook, so a duplicate id can only mean two hosts claimed the same public surface.
 */
export function registerToolset(toolset: AnyToolsetDefinition): void {
  const registry = getToolsetRegistry('registerToolset()');

  if (registry.has(toolset.id)) {
    throw new OpenServiceDuplicateToolsetError({ toolsetId: toolset.id });
  }

  assertNoDerivedNameCollisions(registry, toolset);

  registry.set(toolset.id, {
    ...toolset,
    methods: Object.fromEntries(
      Object.entries(toolset.methods).map(([name, method]) => [
        name,
        { ...method, handler: bindToInstance(method.handler) },
      ])
    ),
  });
}

/**
 * Returns one toolset registered on the current instance by id, typed for the core toolsets.
 *
 * Throws when the id is not registered — an adapter asking for a toolset that no host wired up is
 * a configuration error, not an empty result.
 */
export function getToolset<TId extends keyof KnownToolsets>(toolsetId: TId): KnownToolsets[TId];
export function getToolset(toolsetId: string): AnyToolsetDefinition;
export function getToolset(toolsetId: string): AnyToolsetDefinition {
  const toolset = getToolsetRegistry('getToolset()').get(toolsetId);

  if (!toolset) {
    throw new OpenServiceMissingToolsetError({ toolsetId });
  }

  return toolset;
}

/** All toolsets registered on the current instance. */
export function getRegisteredToolsets(): AnyToolsetDefinition[] {
  return [...getToolsetRegistry('getRegisteredToolsets()').values()];
}

/** Clears the current instance's toolsets. Intended for tests. */
export function clearToolsetRegistry(): void {
  getToolsetRegistry('clearToolsetRegistry()').clear();
}

/** Returns the current instance's toolsets; throws outside an instance. */
function getToolsetRegistry(api: string): Map<string, AnyToolsetDefinition> {
  const context = getInstanceContext();
  if (!context) {
    throw new StorybookInstanceUnavailableError({ reason: 'outside-instance', api });
  }
  let registry = context.state.get(TOOLSET_REGISTRY_KEY) as
    | Map<string, AnyToolsetDefinition>
    | undefined;
  if (!registry) {
    registry = new Map();
    context.state.set(TOOLSET_REGISTRY_KEY, registry);
  }
  return registry;
}

function assertNoDerivedNameCollisions(
  registry: Map<string, AnyToolsetDefinition>,
  toolset: AnyToolsetDefinition
): void {
  const cliNames = new Map<string, string>();

  for (const methodName of Object.keys(toolset.methods)) {
    if (!methodName || methodName.includes('.')) {
      throw new OpenServiceInvalidToolsetMethodIdError({
        methodId: `${toolset.id}.${methodName}`,
      });
    }

    const cliName = toCliMethodName(methodName);
    const priorCli = cliNames.get(cliName);
    if (priorCli) {
      throw new OpenServiceDuplicateToolNameError({
        derivedName: cliName,
        first: `${toolset.id}.${priorCli}`,
        second: `${toolset.id}.${methodName}`,
        transport: 'cli',
      });
    }
    cliNames.set(cliName, methodName);

    const methodId = `${toolset.id}.${methodName}`;
    let mcpName: string;
    try {
      mcpName = toMcpToolName(methodId as `${string}.${string}`);
    } catch {
      throw new OpenServiceInvalidToolsetMethodIdError({ methodId });
    }

    for (const [existingId, existing] of registry) {
      for (const existingMethod of Object.keys(existing.methods)) {
        const existingMethodId = `${existingId}.${existingMethod}`;
        if (toMcpToolName(existingMethodId as `${string}.${string}`) === mcpName) {
          throw new OpenServiceDuplicateToolNameError({
            derivedName: mcpName,
            first: existingMethodId,
            second: methodId,
            transport: 'mcp',
          });
        }
      }
    }
  }
}
