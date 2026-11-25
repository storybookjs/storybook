import { getService } from '../../shared/open-service/server.ts';
import type { Options } from '../../types/index.ts';

import { isAddonA11yEnabled } from './addon-a11y.ts';
import { isAddonVitestEnabled } from './addon-vitest.ts';
import { getManifestStatus } from './manifest-status.ts';

export interface ToolAvailability {
  /** The `core/module-graph` open service is registered/resolvable. Gates `stories-find-by-component`. */
  moduleGraphSupported: boolean;
  /** Component-manifest feature is on AND manifests were found. Gates the `docs` toolset. */
  docsEnabled: boolean;
  /**
   * Docs gate for the `storybook tools` CLI channel, which reads manifests in-process and so only
   * needs manifests to be producible — not the `componentsManifest` opt-in that gates MCP.
   */
  docsEnabledForCli: boolean;
  /** Any component manifests were found (drives the docs "why disabled" copy). */
  docsHasManifests: boolean;
  /** The component-manifest feature flag is enabled (drives the docs "why disabled" copy). */
  docsFeatureEnabled: boolean;
  /**
   * `@storybook/addon-vitest` is enabled (not merely installed), matching the condition under
   * which it registers the `test` toolset. Gates the `test` toolset (`test-run`).
   */
  testSupported: boolean;
  /** `@storybook/addon-a11y` is enabled. Gates the accessibility sub-feature of `test-run`. */
  a11yEnabled: boolean;
  /** `docgenServer` mode: read manifest data in-process from the open services. */
  docgenServer: boolean;
}

/**
 * Composed Storybooks with component manifests can back docs tools even when the
 * local Storybook has no component manifest. Use this before feeding
 * availability into the shared tool registry.
 */
export function getEffectiveToolAvailability(
  availability: ToolAvailability,
  { multiSource = false }: { multiSource?: boolean } = {}
): ToolAvailability {
  if (!multiSource) {
    return availability;
  }

  return {
    ...availability,
    docsEnabled: true,
    docsEnabledForCli: true,
    docsHasManifests: true,
    docsFeatureEnabled: true,
  };
}

/**
 * True iff the `core/module-graph` open service is registered in this process — reflects
 * registration rather than mere runtime presence so tool gating/badging can't drift from the
 * service the dev server actually resolves (a builder may ship change detection but not
 * register the service, e.g. without change detection wired up).
 */
export async function isModuleGraphSupported(): Promise<boolean> {
  try {
    return getService('core/module-graph', { internal: true }) !== undefined;
  } catch {
    // `getService` throws when the service isn't registered in this process.
    return false;
  }
}

/**
 * Single source of truth for the runtime gates that decide whether each tool is
 * registered (and how the landing page badges it).
 *
 * Every dynamic gate lives here — the dependency graph, the component manifest
 * (docs), addon-vitest (test) and the accessibility sub-feature — so the MCP
 * server (which registers the tools) and the browser landing page (which shows
 * enabled/disabled badges) can never drift apart. Add new gates here rather
 * than computing them ad-hoc at a call site.
 */
export async function getToolAvailability(options: Options): Promise<ToolAvailability> {
  const [moduleGraphSupported, manifestStatus, addonVitestEnabled, a11yEnabled] = await Promise.all(
    [
      isModuleGraphSupported(),
      getManifestStatus(options),
      isAddonVitestEnabled(options),
      isAddonA11yEnabled(options),
    ]
  );

  return {
    moduleGraphSupported,
    docsEnabled: manifestStatus.available,
    docsEnabledForCli: manifestStatus.hasManifests,
    docsHasManifests: manifestStatus.hasManifests,
    docsFeatureEnabled: manifestStatus.hasFeatureFlag,
    testSupported: addonVitestEnabled,
    a11yEnabled,
    docgenServer: manifestStatus.docgenServer,
  };
}
