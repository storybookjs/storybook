import type { StrictInputType } from '../../../../core/src/csf/story.ts';
import { hasDefaultValue } from '../compare/argtypes.ts';
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

// Key-sorted JSON so a diff reflects content, never the order a producer happened to emit.
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

  // Anything the rules above did not already explain, reported once per field so a re-record is a
  // reviewable diff rather than an opaque "something moved".
  const fields = new Set([...Object.keys(baseline), ...Object.keys(candidate)]);
  for (const field of [...fields].sort()) {
    const before = baseline[field as keyof SandboxBaseline];
    const after = candidate[field as keyof SandboxBaseline];
    if (equal(before, after) || explained.has(field)) {
      continue;
    }
    if (field === 'argTypes') {
      const { losses, summary } = diffArgTypes(before, after);
      findings.push({
        component,
        severity: losses.length > 0 ? 'regression' : 'change',
        kind: 'argtypes',
        message:
          losses.length > 0
            ? `argTypes lost content (${losses.join('; ')}); full diff: ${summary}`
            : `argTypes differs: ${summary}`,
      });
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

/**
 * One pass over both argTypes tables, yielding the regression list and the readable summary.
 *
 * A loss is an arg the build no longer produces or one that no longer records a default; everything
 * else - added args, reworded prose, a type that resolved differently - is drift accepted by
 * re-recording. The summary names the affected args and sub-fields, because the two sides usually
 * share the same arg names and a key list alone says nothing.
 */
function diffArgTypes(before: unknown, after: unknown): { losses: string[]; summary: string } {
  const beforeArgs = (before ?? {}) as Record<string, StrictInputType>;
  const afterArgs = (after ?? {}) as Record<string, StrictInputType>;
  const args = new Set([...Object.keys(beforeArgs), ...Object.keys(afterArgs)]);
  const losses: string[] = [];
  const parts: string[] = [];
  for (const arg of [...args].sort()) {
    const beforeEntry = beforeArgs[arg];
    const afterEntry = afterArgs[arg];
    if (beforeEntry === undefined) {
      parts.push(`${arg} (added)`);
      continue;
    }
    if (afterEntry === undefined) {
      losses.push(`${arg} removed`);
      parts.push(`${arg} (removed)`);
      continue;
    }
    if (hasDefaultValue(beforeEntry) && !hasDefaultValue(afterEntry)) {
      losses.push(`${arg} lost its default`);
    }
    const subFields = new Set([...Object.keys(beforeEntry), ...Object.keys(afterEntry)]);
    const changed = [...subFields]
      .sort()
      .filter(
        (subField) =>
          !equal(
            beforeEntry[subField as keyof StrictInputType],
            afterEntry[subField as keyof StrictInputType]
          )
      );
    if (changed.length > 0) {
      parts.push(`${arg} (${changed.join(', ')})`);
    }
  }
  return { losses, summary: parts.join('; ') };
}

// Keeps a finding readable when the field is a whole argTypes table or a multi-line message.
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

// Regressions first, since they are the blocking kind.
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
