import {
  OpenServiceDuplicateToolNameError,
  OpenServiceDuplicateToolsetError,
  OpenServiceInvalidToolsetMethodIdError,
  OpenServiceMissingToolsetError,
} from '../../server-errors.ts';
import type { AnyToolsetDefinition } from './toolset-definition.ts';
import type { KnownToolsets } from './toolset-types.ts';
import { toCliMethodName, toMcpToolName } from './toolset-names.ts';

const TOOLSET_REGISTRY_SYMBOL = Symbol.for('storybook.open-service.toolset-registry');

/**
 * Returns the realm-global registry backing toolset registration.
 *
 * Anchored on a `globalThis` symbol for the same reason as the service registry: every module in one
 * realm shares a single toolset inventory even when this file is reached through different import
 * paths. Toolsets are plain definitions (no channel wiring), so one map is the whole registry.
 */
function getToolsetRegistry(): Map<string, AnyToolsetDefinition> {
  const registryGlobal = globalThis as {
    [key: symbol]: Map<string, AnyToolsetDefinition> | undefined;
  };

  registryGlobal[TOOLSET_REGISTRY_SYMBOL] ??= new Map<string, AnyToolsetDefinition>();

  return registryGlobal[TOOLSET_REGISTRY_SYMBOL];
}

function assertNoDerivedNameCollisions(toolset: AnyToolsetDefinition): void {
  const registry = getToolsetRegistry();
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

/**
 * Registers one public toolset in the realm-global registry.
 *
 * Call it from the same place the paired OSA service registers (for core, the `services` preset
 * hook). Registration is deliberately independent of the Node preset system so manager- or
 * preview-realm toolsets can use the same API later.
 *
 * Unlike `registerService`, a repeated id throws instead of being ignored: services re-register
 * legitimately (HMR, repeated composition), while every toolset registration site is a one-shot
 * preset hook, so a duplicate id can only mean two hosts claimed the same public surface.
 */
export function registerToolset(toolset: AnyToolsetDefinition): void {
  const registry = getToolsetRegistry();

  if (registry.has(toolset.id)) {
    throw new OpenServiceDuplicateToolsetError({ toolsetId: toolset.id });
  }

  assertNoDerivedNameCollisions(toolset);

  registry.set(toolset.id, toolset);
}

/**
 * Returns one registered toolset by id, typed for the core toolsets.
 *
 * Throws when the id is not registered — an adapter asking for a toolset that no host wired up is
 * a configuration error, not an empty result.
 */
export function getToolset<TId extends keyof KnownToolsets>(toolsetId: TId): KnownToolsets[TId];
export function getToolset(toolsetId: string): AnyToolsetDefinition;
export function getToolset(toolsetId: string): AnyToolsetDefinition {
  const toolset = getToolsetRegistry().get(toolsetId);

  if (!toolset) {
    throw new OpenServiceMissingToolsetError({ toolsetId });
  }

  return toolset;
}

/** All toolsets currently registered in this realm. */
export function getRegisteredToolsets(): AnyToolsetDefinition[] {
  return [...getToolsetRegistry().values()];
}

/** Clears the realm-global toolset registry. Intended for tests. */
export function clearToolsetRegistry(): void {
  getToolsetRegistry().clear();
}
