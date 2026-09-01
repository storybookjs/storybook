import { readdirSync } from 'node:fs';

import { AGENTIC_REF_CASES } from '../cases.ts';
import { EXPERIMENT_NAME_PREFIX } from '../constants.ts';
import { shortNameOf } from '../utils.ts';

export interface ResolvedCase {
  caseName: string;
  experiment: string;
  shortName: string;
  description?: string;
}

function resolvedCases(): ResolvedCase[] {
  return AGENTIC_REF_CASES.map((c) => ({
    caseName: c.name,
    experiment: `${EXPERIMENT_NAME_PREFIX}${c.name}`,
    shortName: shortNameOf(c.name),
    description: c.description,
  }));
}

export function resolveCase(input: string): ResolvedCase {
  const matches = resolvedCases().filter(
    (c) => c.shortName === input || c.caseName === input || c.experiment === input
  );
  if (matches.length === 1) return matches[0]!;
  const known = resolvedCases()
    .map((c) => c.shortName)
    .sort()
    .join(', ');
  if (matches.length === 0) throw new Error(`Unknown case "${input}". Known cases: ${known}`);
  throw new Error(
    `Ambiguous case "${input}": matches ${matches.map((c) => c.caseName).join(', ')}`
  );
}

export function resolveTreatments(
  tokens: readonly string[],
  control: ResolvedCase,
  experimentsWithData: string[]
): ResolvedCase[] {
  if (tokens.length === 0 || (tokens.length === 1 && tokens[0] === 'all')) {
    return resolvedCases()
      .filter((c) => c.caseName !== control.caseName)
      .filter((c) => experimentsWithData.includes(c.experiment))
      .sort((a, b) => a.caseName.localeCompare(b.caseName));
  }
  const treatments = tokens.map((name) => resolveCase(name));
  if (treatments.some((c) => c.caseName === control.caseName)) {
    throw new Error(`The control case "${control.shortName}" cannot also be a treatment.`);
  }
  // Deduplicate by caseName, keeping first occurrence and preserving order
  const seen = new Set<string>();
  return treatments.filter((c) => {
    if (seen.has(c.caseName)) return false;
    seen.add(c.caseName);
    return true;
  });
}

export function knownWorkflows(evalsDir: string): string[] {
  return readdirSync(evalsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^7\d\d-/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

export function resolveWorkflows(tokens: readonly string[], known: string[]): string[] | null {
  if (tokens.length === 0) return null;
  if (tokens.length === 1 && tokens[0] === 'all') return [...known];
  const resolved = tokens.map((name) => {
    const matches = known.filter((w) => w === name || w.startsWith(`${name}-`));
    if (matches.length === 1) return matches[0]!;
    throw new Error(
      matches.length === 0
        ? `Unknown workflow "${name}". Known workflows: ${known.join(', ')}`
        : `Ambiguous workflow "${name}": matches ${matches.join(', ')}`
    );
  });
  return [...new Set(resolved)].sort();
}

/**
 * What a resolved plan asks results:compare to look at: its arms besides the
 * control become the treatments, its evals the workflow list.
 */
export function resolvePlanScope(
  plan: { experiments: readonly string[]; evals: readonly string[] },
  control: ResolvedCase
): { treatments: ResolvedCase[]; workflows: string[] } {
  const treatments = plan.experiments
    .filter((experiment) => experiment !== control.experiment)
    .map((experiment) => resolveCase(experiment));
  if (treatments.length === 0) {
    throw new Error(`The plan names no case besides the control "${control.shortName}".`);
  }
  return { treatments, workflows: [...plan.evals].sort() };
}

/** Deterministic output-directory slug for a comparison. */
export function comparisonSlug(
  control: ResolvedCase,
  treatments: ResolvedCase[],
  workflows: string[]
): string {
  const t = treatments
    .map((c) => c.shortName)
    .sort()
    .join('+');
  const w = workflows
    .map((name) => name.split('-')[0]!)
    .sort()
    .join('+');
  return `${control.shortName}_vs_${t}@${w}`;
}
