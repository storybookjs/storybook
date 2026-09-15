import { getService } from '../../shared/open-service/server.ts';
import { importModule } from '../../shared/utils/module.ts';
import type { Builder, CoreConfig, Options } from '../../types/index.ts';

import { isAddonA11yEnabled } from './addon-a11y.ts';
import { isAddonVitestEnabled } from './addon-vitest.ts';
import { getManifestStatus, type ManifestFeatures } from './manifest-status.ts';
import { getReviewStatus } from './review-status.ts';

export interface ToolAvailability {
  /** The `core/module-graph` open service is registered/resolvable. Gates `stories-find-by-component`. */
  moduleGraphSupported: boolean;
  /** The `changeDetection` feature flag is enabled. Gates `stories-changed`. */
  changeDetectionEnabled: boolean;
  /** The `experimentalReview` AND `changeDetection` feature flags are enabled. Gates `review-create` for direct MCP clients. */
  reviewEnabled: boolean;
  /**
   * Same gate for the `storybook ai` CLI channel (the Claude/Codex plugins),
   * where review is on by default: `changeDetection` on and `experimentalReview`
   * not explicitly `false`. Gates `review-create` for CLI-marked requests and
   * everything derived from the storybook-ai metadata preset.
   */
  reviewEnabledForCli: boolean;
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
  /** `experimentalDocgenServer` mode: read manifest data in-process from the open services. */
  docgenServer: boolean;
}

export interface GetToolAvailabilityOptions {
  /**
   * Pre-resolved `features` preset. Pass it to avoid re-applying the preset and
   * risking a different snapshot than the caller already resolved.
   */
  features?:
    | (ManifestFeatures & { changeDetection?: boolean; experimentalReview?: boolean })
    | undefined;
  /**
   * Pre-resolved module-graph support. The live MCP server should omit this so it
   * probes the registered open service. Serverless metadata can pass a builder-level
   * capability check because no dev-server service exists in that process.
   */
  moduleGraphSupported?: boolean | undefined;
}

/**
 * Composed Storybooks with component manifests can back docs tools even when the
 * local Storybook has no component manifest. Use this before feeding
 * availability into the shared tool registry so live MCP registration and
 * serverless AI metadata make the same docs-tool decision.
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

export async function isModuleGraphSupportedByBuilder(
  options: Pick<Options, 'presets'>
): Promise<boolean> {
  const core = (await options.presets.apply('core', {})) as CoreConfig | undefined;
  const builder = core?.builder;
  const builderName = typeof builder === 'string' ? builder : builder?.name;
  if (!builderName) {
    return false;
  }

  try {
    const previewBuilder = (await importModule(builderName)) as Partial<Builder<unknown>>;
    return typeof previewBuilder.changeDetectionAdapter === 'function';
  } catch {
    return false;
  }
}

/**
 * Single source of truth for the runtime gates that decide whether each tool is
 * registered (and how the landing page badges it).
 *
 * Every dynamic gate lives here — the dependency graph, the change-detection
 * pipeline, review, the component manifest (docs), addon-vitest (test) and the
 * accessibility sub-feature — so the MCP server (which registers the tools) and
 * the browser landing page (which shows enabled/disabled badges) can never drift
 * apart. Add new gates here rather than computing them ad-hoc at a call site.
 */
export async function getToolAvailability(
  options: Options,
  { features, moduleGraphSupported: moduleGraphSupportedOverride }: GetToolAvailabilityOptions = {}
): Promise<ToolAvailability> {
  const resolvedFeatures =
    features ??
    ((await options.presets.apply('features', {})) as
      | (ManifestFeatures & { changeDetection?: boolean; experimentalReview?: boolean })
      | undefined);

  const [moduleGraphSupported, reviewStatus, manifestStatus, addonVitestEnabled, a11yEnabled] =
    await Promise.all([
      moduleGraphSupportedOverride ?? isModuleGraphSupported(),
      getReviewStatus(options, { features: resolvedFeatures }),
      getManifestStatus(options),
      isAddonVitestEnabled(options),
      isAddonA11yEnabled(options),
    ]);

  return {
    moduleGraphSupported,
    changeDetectionEnabled: resolvedFeatures?.changeDetection ?? false,
    reviewEnabled: reviewStatus.available,
    reviewEnabledForCli: reviewStatus.availableForCli,
    docsEnabled: manifestStatus.available,
    docsEnabledForCli: manifestStatus.hasManifests,
    docsHasManifests: manifestStatus.hasManifests,
    docsFeatureEnabled: manifestStatus.hasFeatureFlag,
    testSupported: addonVitestEnabled,
    a11yEnabled,
    docgenServer: manifestStatus.docgenServer,
  };
}
