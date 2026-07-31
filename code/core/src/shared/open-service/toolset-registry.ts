import type { AnyToolsetDefinition } from './toolset-definition.ts';

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

/**
 * Registers one public toolset in the realm-global registry.
 *
 * Call it from the same place the paired OSA service registers (for core, the `services` preset
 * hook). Registration is deliberately independent of the Node preset system so manager- or
 * preview-realm toolsets can use the same API later. Idempotent by id, mirroring `registerService`:
 * a repeated registration is a no-op.
 */
export function registerToolset(toolset: AnyToolsetDefinition): void {
  const registry = getToolsetRegistry();

  if (!registry.has(toolset.id)) {
    registry.set(toolset.id, toolset);
  }
}

/**
 * Returns the registered toolsets in registration order.
 *
 * Adapter-facing: the MCP server (Milestone 4) and the `storybook tools` CLI (Milestone 5) read the
 * public tool surface from here; nothing consumes it before then.
 */
export function getRegisteredToolsets(): AnyToolsetDefinition[] {
  return Array.from(getToolsetRegistry().values());
}

/** Clears the registry. Tests call this so registrations do not leak between cases. */
export function clearToolsetRegistry(): void {
  getToolsetRegistry().clear();
}
