import type { SBType } from '../../../../core/src/csf/SBType.ts';
import type { StrictArgTypes, StrictInputType } from '../../../../core/src/csf/story.ts';
import type { Violation } from './types.ts';

/**
 * Compares a candidate extraction against a baseline per key: nothing recorded may be lost, and
 * types may only change by deep equality or an enumerated improvement. Deliberately NOT compared
 * (each would entrench recorded lies or lateral engine vocabulary): `required` in both notions
 * (legacy Angular hardcodes `required: true` for every input, #28706), `table.category`,
 * `table.jsDocTags`, `control`/`action`, `table.type.summary`, and description/default contents.
 */
export function compareArgTypes(baseline: StrictArgTypes, candidate: StrictArgTypes): Violation[] {
  const violations: Violation[] = [];
  for (const [arg, baseEntry] of Object.entries(baseline)) {
    const candidateEntry = candidate[arg] as StrictInputType | undefined;
    if (candidateEntry === undefined) {
      violations.push({
        arg,
        kind: 'lost-arg',
        message: 'recorded in the baseline but missing from the candidate',
      });
      continue;
    }
    if (
      normalizeDescription(baseEntry.description) !== undefined &&
      normalizeDescription(candidateEntry.description) === undefined
    ) {
      violations.push({
        arg,
        kind: 'lost-description',
        message: 'the baseline records a description but the candidate has none',
      });
    }
    if (hasDefaultValue(baseEntry) && !hasDefaultValue(candidateEntry)) {
      violations.push({
        arg,
        kind: 'lost-default',
        message: `the baseline records a default value (${describeDefault(baseEntry)}) but the candidate has none`,
      });
    }
    const baseType = baseEntry.type;
    const candidateType = candidateEntry.type;
    if (baseType != null) {
      if (candidateType == null) {
        violations.push({
          arg,
          kind: 'lost-type',
          message: `the baseline records type ${printType(baseType)} but the candidate has none`,
        });
      } else if (!typeCurrentOrBetter(baseType, candidateType)) {
        violations.push({
          arg,
          kind: 'type-fidelity',
          message: `type fidelity decreased or changed laterally: baseline ${printType(baseType)}, candidate ${printType(candidateType)}`,
        });
      }
    }
  }
  return violations;
}

const normalizeDescription = (description: unknown): string | undefined => {
  if (typeof description !== 'string') {
    return undefined;
  }
  const trimmed = description.trim();
  return trimmed === '' ? undefined : trimmed;
};

/**
 * A default is present when either recorded location is strictly not-undefined. Never a truthy
 * check: eight committed Angular baselines record `{ summary: NaN }`, and `0`, `false`, `''` are
 * real defaults too.
 */
const hasDefaultValue = (entry: StrictInputType): boolean =>
  entry.defaultValue !== undefined || entry.table?.defaultValue?.summary !== undefined;

const describeDefault = (entry: StrictInputType): string =>
  entry.defaultValue !== undefined
    ? `defaultValue: ${String(entry.defaultValue)}`
    : `table summary: ${String(entry.table?.defaultValue?.summary)}`;

const printType = (type: SBType): string => JSON.stringify(canonicalType(type));

/**
 * The type pass-list: deep equality after normalization, or an enumerated improvement. Everything
 * lateral fails and is accepted only through a reviewed baseline update.
 */
function typeCurrentOrBetter(baseline: SBType, candidate: SBType): boolean {
  if (deepEqual(canonicalType(baseline), canonicalType(candidate))) {
    return true;
  }
  if (baseline.name === 'other') {
    if (candidate.name === 'other') {
      return normalizeLiteral(baseline.value) === normalizeLiteral(candidate.value);
    }
    // Only a genuine catch-all (empty-enum, void, raw type text) improves by becoming any
    // structured type. A QUOTED-literal other is Vue's union-member encoding of a string
    // literal - it falls through to the member-set rule below, so degrading it to a bare
    // scalar fails (AC1's "union collapsing to string", one wrapper level deep).
    if (!isQuotedToken(baseline.value)) {
      return true;
    }
  }
  const baselineMembers = memberSet(baseline);
  const candidateMembers = memberSet(candidate);
  if (
    baselineMembers !== undefined &&
    candidateMembers !== undefined &&
    [...baselineMembers].every((member) => candidateMembers.has(member))
  ) {
    return true;
  }
  if (
    baseline.name === candidate.name &&
    (baseline.name === 'union' || baseline.name === 'intersection')
  ) {
    const candidateValues = (candidate as Extract<SBType, { name: typeof baseline.name }>).value;
    return baseline.value.every((member) =>
      candidateValues.some((candidateMember) => typeCurrentOrBetter(member, candidateMember))
    );
  }
  if (baseline.name === 'tuple' && candidate.name === 'tuple') {
    // Tuples are positional: each recorded slot must survive at its index; appended slots pass.
    return (
      candidate.value.length >= baseline.value.length &&
      baseline.value.every((member, index) => typeCurrentOrBetter(member, candidate.value[index]))
    );
  }
  if (baseline.name === 'object' && candidate.name === 'object') {
    // An empty baseline value means "not extracted", so any candidate object improves on it.
    return Object.entries(baseline.value).every(
      ([key, member]) =>
        candidate.value[key] !== undefined && typeCurrentOrBetter(member, candidate.value[key])
    );
  }
  if (baseline.name === 'array' && candidate.name === 'array') {
    return typeCurrentOrBetter(baseline.value, candidate.value);
  }
  return false;
}

/** Ignores `required` and `raw` at every level and normalizes literal-ish values. */
function canonicalType(type: SBType): unknown {
  switch (type.name) {
    case 'enum':
      return { name: 'enum', value: type.value.map(normalizeLiteral) };
    case 'union':
    case 'intersection':
    case 'tuple':
      return { name: type.name, value: type.value.map(canonicalType) };
    case 'object':
      return {
        name: 'object',
        value: Object.fromEntries(
          Object.entries(type.value).map(([key, member]) => [key, canonicalType(member)])
        ),
      };
    case 'array':
      return { name: 'array', value: canonicalType(type.value) };
    case 'literal':
      return { name: 'literal', value: normalizeLiteral(type.value) };
    case 'other':
      return { name: 'other', value: normalizeLiteral(type.value) };
    case 'node':
      return { name: 'node', renderer: type.renderer };
    default:
      return { name: type.name };
  }
}

/**
 * Literal-ish values compare as strings with symmetric surrounding quotes stripped: the corpus
 * records the same member as '"small"' (Vue other-typed union member), 'small' (Angular enum
 * value), or a literal member value.
 */
const normalizeLiteral = (value: unknown): string => {
  if (typeof value === 'string') {
    const match = /^"([^"]*)"$/.exec(value) ?? /^'([^']*)'$/.exec(value);
    if (match) {
      return match[1];
    }
    return value;
  }
  return String(value);
};

/**
 * Extracts a comparable member set from an enum, a union/intersection whose members are all
 * literal-ish, or a single literal-shaped type (a `literal` or a quoted-token `other` - both
 * singletons, so a literal may widen into an enum/union that keeps it). Returns undefined when
 * any member is structural.
 */
function memberSet(type: SBType): Set<string> | undefined {
  if (type.name === 'enum') {
    return new Set(type.value.map(normalizeLiteral));
  }
  if (type.name === 'literal') {
    return new Set([normalizeLiteral(type.value)]);
  }
  if (type.name === 'other' && typeof type.value === 'string' && isQuotedToken(type.value)) {
    return new Set([normalizeLiteral(type.value)]);
  }
  if (type.name === 'union' || type.name === 'intersection') {
    const members = type.value.map(literalishMember);
    if (members.every((member) => member !== undefined)) {
      return new Set(members as string[]);
    }
  }
  return undefined;
}

const literalishMember = (member: SBType): string | undefined => {
  if (member.name === 'literal') {
    return normalizeLiteral(member.value);
  }
  if (member.name === 'other' && typeof member.value === 'string' && isSingleToken(member.value)) {
    return normalizeLiteral(member.value);
  }
  return undefined;
};

const isSingleToken = (value: string): boolean =>
  /^"[^"]*"$/.test(value) || /^'[^']*'$/.test(value) || /^\S+$/.test(value);

const isQuotedToken = (value: unknown): boolean =>
  typeof value === 'string' && (/^"[^"]*"$/.test(value) || /^'[^']*'$/.test(value));

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }
  if (
    a !== null &&
    b !== null &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return (
      aKeys.length === bKeys.length &&
      aKeys.every(
        (key) =>
          Object.prototype.hasOwnProperty.call(b, key) &&
          deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
      )
    );
  }
  return false;
}
