import type { StrictArgTypes } from '../../../../core/src/csf/story.ts';
import { compareArgTypes } from '../compare/argtypes.ts';
import type { SandboxBaseline, SandboxBaselines } from './read-static-docgen.ts';

export interface BaselineFinding {
  component: string;
  severity: 'regression' | 'change';
  kind:
    | 'component-removed'
    | 'component-added'
    | 'docgen-lost'
    | 'docgen-gained'
    | 'argtypes'
    | 'field-changed';
  message: string;
}

/** Key-sorted JSON so a diff reflects content, never the order a producer happened to emit. */
export function stableStringify(value: unknown, indent = 2): string {
  const sortKeys = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map(sortKeys);
    }
    if (input !== null && typeof input === 'object') {
      return Object.fromEntries(
        Object.entries(input)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, sortKeys(item)])
      );
    }
    return input;
  };
  return JSON.stringify(sortKeys(value), null, indent);
}

const equal = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);

/** A component counts as documented when the provider produced props rather than an error. */
const isDocumented = (entry: SandboxBaseline): boolean =>
  entry.error === undefined && entry.argTypes !== undefined;

const countArgs = (entry: SandboxBaseline): number => Object.keys(entry.argTypes ?? {}).length;

function compareComponent(
  component: string,
  baseline: SandboxBaseline,
  candidate: SandboxBaseline
): BaselineFinding[] {
  const findings: BaselineFinding[] = [];

  if (isDocumented(baseline) && !isDocumented(candidate)) {
    findings.push({
      component,
      severity: 'regression',
      kind: 'docgen-lost',
      message: candidate.error
        ? `was documented with ${countArgs(baseline)} arg(s), now errors: ${candidate.error.name}: ${candidate.error.message}`
        : `was documented with ${countArgs(baseline)} arg(s), now produces no argTypes`,
    });
    // The argTypes comparison below would restate every lost arg; the summary above is enough.
    return findings;
  }

  // Fields whose difference a finding above already states, so the per-field pass stays quiet
  // instead of restating it.
  const explained = new Set<string>();

  if (!isDocumented(baseline) && isDocumented(candidate)) {
    findings.push({
      component,
      severity: 'change',
      kind: 'docgen-gained',
      message: `was undocumented, now yields ${countArgs(candidate)} arg(s)`,
    });
    explained.add('argTypes').add('error');
  }

  for (const violation of compareArgTypes(
    (baseline.argTypes ?? {}) as StrictArgTypes,
    (candidate.argTypes ?? {}) as StrictArgTypes
  )) {
    findings.push({
      component,
      severity: 'regression',
      kind: 'argtypes',
      message: `${violation.arg}: [${violation.kind}] ${violation.message}`,
    });
    explained.add('argTypes');
  }

  // Anything the rules above did not already explain, reported once per field so a re-record is a
  // reviewable diff rather than an opaque "something moved".
  const fields = new Set([...Object.keys(baseline), ...Object.keys(candidate)]);
  for (const field of [...fields].sort()) {
    const before = baseline[field as keyof SandboxBaseline];
    const after = candidate[field as keyof SandboxBaseline];
    if (equal(before, after) || explained.has(field)) {
      continue;
    }
    findings.push({
      component,
      severity: 'change',
      kind: 'field-changed',
      message: `${field} differs (baseline ${JSON.stringify(summarize(before))}, candidate ${JSON.stringify(summarize(after))})`,
    });
  }

  return findings;
}

/** Keeps a finding readable when the field is a whole argTypes table or a multi-line message. */
const summarize = (value: unknown): unknown => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    const flat = value.replace(/\s+/g, ' ').trim();
    return flat.length > 80 ? `${flat.slice(0, 77)}...` : flat;
  }
  if (typeof value === 'object' && value !== null) {
    return `{${Object.keys(value).sort().join(', ')}}`;
  }
  return value;
};

/** Compares a committed baseline set against a freshly-read one, component by component. */
export function compareBaselines(
  baseline: SandboxBaselines,
  candidate: SandboxBaselines
): BaselineFinding[] {
  const findings: BaselineFinding[] = [];
  const components = new Set([...Object.keys(baseline), ...Object.keys(candidate)]);

  for (const component of [...components].sort()) {
    const before = baseline[component];
    const after = candidate[component];

    if (before === undefined) {
      findings.push({
        component,
        severity: 'change',
        kind: 'component-added',
        message: 'not in the baseline; re-record to adopt it',
      });
      continue;
    }
    if (after === undefined) {
      findings.push({
        component,
        severity: 'regression',
        kind: 'component-removed',
        message:
          'recorded in the baseline but absent from this build; the story may have been removed, or indexing dropped it',
      });
      continue;
    }

    findings.push(...compareComponent(component, before, after));
  }

  return findings;
}

/** Groups findings for the CLI report: regressions first, since they are the blocking kind. */
export function formatFindings(findings: BaselineFinding[]): string {
  const lines: string[] = [];
  for (const severity of ['regression', 'change'] as const) {
    const group = findings.filter((finding) => finding.severity === severity);
    if (group.length === 0) {
      continue;
    }
    lines.push(`${group.length} ${severity}(s):`);
    for (const finding of group) {
      lines.push(`  - ${finding.component} [${finding.kind}] ${finding.message}`);
    }
  }
  return lines.join('\n');
}
