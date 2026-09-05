// Locating and loading plan configs (plans/<name>.plan.ts), shared by the
// plan runner (scripts/run-plan.ts) and results:compare's and
// judge:ds-misuse's --plan scoping.
import { existsSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { AGENT_EVAL_ROOT } from './constants.ts';
import { resolveRunPlan, type ResolvedRunPlan, type RunPlan } from './run-plan.ts';

/**
 * The file a plan spelling names: a bare name (`1-levels-edit`) expands to
 * plans/<name>.plan.ts, and a relative path resolves against the repo root.
 */
export function resolvePlanPath(input: string): string {
  const path = /^[\w-]+$/.test(input) ? join('plans', `${input}.plan.ts`) : input;
  return isAbsolute(path) ? path : resolve(AGENT_EVAL_ROOT, path);
}

/** Loads a plan config module and returns its default-exported RunPlan. */
export async function loadPlanConfig(configPath: string): Promise<RunPlan> {
  if (!existsSync(configPath)) {
    throw new Error(`no plan config at ${relative(AGENT_EVAL_ROOT, configPath)}.`);
  }
  const module: unknown = await import(pathToFileURL(configPath).href);
  const plan = (module as { default?: unknown }).default;
  if (plan === undefined || plan === null || typeof plan !== 'object') {
    throw new Error(
      `${relative(AGENT_EVAL_ROOT, configPath)} must default-export a RunPlan object.`
    );
  }
  return plan as RunPlan;
}

/** A `--plan` flag alongside whatever case/workflow selection came with it. */
export interface PlanFlagOptions {
  plan: string | undefined;
  experiments: readonly string[];
  evals: readonly string[];
}

/**
 * Resolves a `--plan` flag into the cases and workflows it names, or returns
 * null when no plan was given.
 *
 * Rejects an explicit case/workflow selection alongside `--plan`: a plan
 * already names both, so the two would either agree redundantly or silently
 * disagree. `flagHint` names the selection flags in the caller's own
 * vocabulary (`--experiments/--evals`, `--cases/--workflows`) for the error.
 */
export async function resolvePlanFlag(
  options: PlanFlagOptions,
  registries: { experiments: readonly string[]; evals: readonly string[] },
  flagHint: string
): Promise<ResolvedRunPlan | null> {
  if (options.plan === undefined) {
    return null;
  }
  if (options.experiments.length > 0 || options.evals.length > 0) {
    throw new Error(
      `--plan already names the cases and workflows; drop ${flagHint} ` +
        '(or unset AGENTIC_REF_EXPERIMENTS/AGENTIC_REF_EVALS).'
    );
  }
  return resolveRunPlan(await loadPlanConfig(resolvePlanPath(options.plan)), registries);
}

/**
 * The effective `since` cutoff when a CLI value and a plan's own value both
 * apply: the later of the two, so a CLI flag can narrow a plan's scope but
 * never widen it. Falls back to whichever one exists, and null when neither
 * does.
 */
export function laterSince(cliSince: string | null, planSince: Date | null): string | null {
  if (cliSince === null) {
    return planSince === null ? null : planSince.toISOString();
  }
  if (planSince === null) {
    return cliSince;
  }
  return new Date(cliSince).getTime() >= planSince.getTime() ? cliSince : planSince.toISOString();
}
