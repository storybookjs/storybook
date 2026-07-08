import { HandledError } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';
import type { StorybookFeatures } from 'storybook/internal/types';

import semver from 'semver';

import { updateMainConfig } from './automigrate/helpers/mainConfigFile.ts';
import type { UpgradeOptions } from './upgrade.ts';
import type { CollectProjectsSuccessResult } from './util.ts';

export interface ExperimentalFlagDefinition {
  name: keyof StorybookFeatures;
  description: string;
  docsUrl: string;
  introducedIn: string;
  /**
   * Features this flag builds on. A project that has explicitly disabled one of these is skipped
   * (with a warning) when writing the flag, since the flag would be inert there.
   */
  requires?: (keyof StorybookFeatures)[];
}

export const EXPERIMENTAL_FLAGS_MIN_VERSION = '10.5.0';

/** Hardcoded registry of newly introduced experimental flags, manually curated per release. */
export const EXPERIMENTAL_FLAGS_REGISTRY: ExperimentalFlagDefinition[] = [
  {
    name: 'experimentalReview',
    description:
      'Offers the agentic review workflow (review UI + server review channel) to all MCP clients, not just the storybook ai CLI channel. Builds on changeDetection (enabled by default).',
    docsUrl:
      'https://storybook.js.org/docs/next/api/main-config/main-config-features#experimentalreview',
    introducedIn: '10.5.0',
    requires: ['changeDetection'],
  },
  {
    name: 'experimentalDocgenServer',
    description:
      'Enables server-side docgen for React projects: faster startup, more accurate Controls/ArgTypes, and improved static code snippets in docs.',
    docsUrl:
      'https://storybook.js.org/docs/next/api/main-config/main-config-features#experimentaldocgenserver',
    introducedIn: '10.5.0',
  },
];

/**
 * Whether a single project's upgrade crosses the 10.5 boundary within the same major.
 *
 * The same-major restriction is intentional (per spec): cross-major upgrades (e.g. 9.x to 10.5)
 * do not trigger the highlight step. Do not "fix" this without re-confirming intent.
 */
export function projectNeedsFlagsHighlight(beforeVersion: string, targetVersion: string): boolean {
  try {
    return (
      semver.lt(beforeVersion, EXPERIMENTAL_FLAGS_MIN_VERSION) &&
      semver.gte(targetVersion, EXPERIMENTAL_FLAGS_MIN_VERSION) &&
      semver.major(beforeVersion) === semver.major(targetVersion)
    );
  } catch {
    return false;
  }
}

export function selectProjectsNeedingFlagsHighlight(
  projects: CollectProjectsSuccessResult[]
): CollectProjectsSuccessResult[] {
  return projects.filter((p) => projectNeedsFlagsHighlight(p.beforeVersion, p.currentCLIVersion));
}

/**
 * Registry flags NOT already explicitly set (true or false) in a project's main config. A project
 * without a resolvable main config path has nothing pending, since it can never be written to.
 */
export function pendingFlagsForProject(
  project: CollectProjectsSuccessResult,
  registry: ExperimentalFlagDefinition[] = EXPERIMENTAL_FLAGS_REGISTRY
): ExperimentalFlagDefinition[] {
  if (!project.mainConfigPath) {
    return [];
  }
  return registry.filter((flag) => project.mainConfig?.features?.[flag.name] === undefined);
}

/** True when every project already has every registry flag explicitly set. */
export function shouldSkipEntireStep(
  projects: CollectProjectsSuccessResult[],
  registry: ExperimentalFlagDefinition[] = EXPERIMENTAL_FLAGS_REGISTRY
): boolean {
  return projects.every((p) => pendingFlagsForProject(p, registry).length === 0);
}

export function parseFeatureNames(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateFeatureNames(
  names: string[],
  registry: ExperimentalFlagDefinition[] = EXPERIMENTAL_FLAGS_REGISTRY
): void {
  const validNames = registry.map((f) => f.name);
  const unknown = names.filter((n) => !validNames.includes(n as keyof StorybookFeatures));
  if (unknown.length > 0) {
    const message = `Unknown experimental flag(s): ${unknown.join(', ')}. Available flags: ${validNames.join(', ')}.`;
    // HandledError is skipped by the upstream error printers (withTelemetry,
    // handleCommandFailure), which assume the message was already logged before the throw.
    logger.error(message);
    throw new HandledError(message);
  }
}

export async function promptForExperimentalFlags(
  registry: ExperimentalFlagDefinition[] = EXPERIMENTAL_FLAGS_REGISTRY
): Promise<string[]> {
  const choices = registry.map((flag) => ({
    value: flag.name as string,
    label: flag.name as string,
    // The "\n" in the hint renders as a raw, unindented line break in some terminals (clack does
    // not wrap multiselect hints); same behavior as promptForAutomigrations' link hints.
    hint: `${flag.description}\n${flag.docsUrl}`,
  }));

  return prompt.multiselect({
    message: 'Storybook 10.5 introduces new experimental flags. Enable any of them?',
    options: choices,
    initialValues: [],
    required: false,
  });
}

export async function applyFlagsToProjects(
  projects: CollectProjectsSuccessResult[],
  flags: ExperimentalFlagDefinition[],
  dryRun: boolean
): Promise<void> {
  for (const project of projects) {
    if (!project.mainConfigPath) {
      continue;
    }
    const flagsToWrite = flags
      .filter((flag) => project.mainConfig?.features?.[flag.name] === undefined)
      .filter((flag) => {
        const disabledDependency = flag.requires?.find(
          (dep) => project.mainConfig?.features?.[dep] === false
        );
        if (disabledDependency) {
          logger.warn(
            `Skipping ${flag.name} for ${project.configDir}: it builds on ${disabledDependency}, which is explicitly disabled in this project.`
          );
          return false;
        }
        return true;
      });
    if (flagsToWrite.length === 0) {
      continue;
    }
    await updateMainConfig({ mainConfigPath: project.mainConfigPath, dryRun }, async (main) => {
      for (const flag of flagsToWrite) {
        if (main.getSafeFieldValue(['features', flag.name]) === undefined) {
          main.setFieldValue(['features', flag.name], true);
        }
      }
    });
    if (!dryRun) {
      // Keep the in-memory snapshot in sync: this step runs right before
      // runAutomigrations(storybookProjects, ...), and a future Fix.check() reading
      // mainConfig.features would otherwise see stale (pre-write) state.
      // (updateMainConfig logs-and-swallows write failures, so in that already-logged
      // rare case the snapshot may be optimistic - same convention as automigration fixes.)
      project.mainConfig.features = {
        ...project.mainConfig.features,
        ...Object.fromEntries(flagsToWrite.map((flag) => [flag.name, true])),
      };
    }
  }
}

interface ExperimentalFlagsTelemetryPayload {
  flags: string[];
  source: 'prompt' | 'features-flag';
}

async function sendExperimentalFlagsTelemetry(
  payload: ExperimentalFlagsTelemetryPayload
): Promise<void> {
  try {
    await telemetry('upgrade-experimental-flags', payload);
  } catch (error) {
    logger.debug(`Failed to send experimental-flags telemetry: ${String(error)}`);
  }
}

/** Orchestrator, called from upgrade.ts after the dependency update, before runAutomigrations. */
export async function runExperimentalFlagsHighlightStep(
  storybookProjects: CollectProjectsSuccessResult[],
  options: Pick<UpgradeOptions, 'features' | 'yes' | 'dryRun'>
): Promise<void> {
  const dryRun = Boolean(options.dryRun);
  const requestedNames = parseFeatureNames(options.features);

  // An explicit --features request always applies (regardless of the version gate below), so
  // projects already on >= 10.5 still have a CLI surface to enable these flags.
  if (requestedNames.length > 0) {
    validateFeatureNames(requestedNames);
    if (dryRun) {
      logger.log(
        `Experimental flags (dry run - no changes will be made): would enable ${requestedNames.join(', ')}`
      );
      return;
    }
    const flagsToApply = EXPERIMENTAL_FLAGS_REGISTRY.filter((f) => requestedNames.includes(f.name));
    await applyFlagsToProjects(storybookProjects, flagsToApply, dryRun);
    await sendExperimentalFlagsTelemetry({
      // Derived from the registry filter rather than the raw input, so duplicate names in
      // --features do not produce duplicate telemetry entries.
      flags: flagsToApply.map((f) => f.name),
      source: 'features-flag',
    });
    return;
  }

  const eligibleProjects = selectProjectsNeedingFlagsHighlight(storybookProjects);
  if (eligibleProjects.length === 0) {
    return;
  }

  if (shouldSkipEntireStep(storybookProjects)) {
    return;
  }

  if (dryRun) {
    const pendingNames = [
      ...new Set(storybookProjects.flatMap((p) => pendingFlagsForProject(p).map((f) => f.name))),
    ];
    logger.log(
      `New experimental flags available (dry run - no changes will be made): ${pendingNames.join(', ')}`
    );
    return;
  }

  if (options.yes) {
    return;
  }

  const selectedNames = await promptForExperimentalFlags();
  if (selectedNames.length === 0) {
    return;
  }

  const flagsToApply = EXPERIMENTAL_FLAGS_REGISTRY.filter((f) => selectedNames.includes(f.name));
  await applyFlagsToProjects(storybookProjects, flagsToApply, dryRun);
  await sendExperimentalFlagsTelemetry({
    flags: flagsToApply.map((f) => f.name),
    source: 'prompt',
  });
}
