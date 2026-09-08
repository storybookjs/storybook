import type { SBType } from '../../../../core/src/csf/SBType.ts';
import type { StrictArgTypes, StrictInputType } from '../../../../core/src/csf/story.ts';
import { deepEqual } from './deep-equal.ts';
import type { Violation } from './types.ts';

export interface CompareArgTypesOptions {
  /** Waive the legacy Angular pipeline's invented defaults, which must not be ratcheted. */
  legacyBaseline?: boolean;
  /** Also gate `table.type.summary` text and the `required` flag, for a same-engine baseline. */
  strictTable?: boolean;
}

/**
 * Report every way the candidate argTypes document less than the baseline.
 *
 * The comparator deliberately passes description and default CONTENT changes, `table.category`,
 * `control`, `action`, per-arg `jsDocTags`, added args, and enum supersets: those are
 * engine-specific vocabulary, reviewed through the byte-exact snapshot diffs instead.
 */
export function compareArgTypes(
  baseline: StrictArgTypes,
  candidate: StrictArgTypes,
  options: CompareArgTypesOptions = {}
): Violation[] {
  const violations: Violation[] = [];
  for (const [arg, baseEntry] of Object.entries(baseline)) {
    // ES-private `#member`s are inaccessible outside their class; legacy Compodoc records them
    // anyway, and the modern extractor only surfaces them under `propsTable: 'all'`. Their loss
    // never gates.
    if (arg.startsWith('#')) {
      continue;
    }
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
    if (
      hasDefaultValue(baseEntry, options.legacyBaseline === true) &&
      // The waiver is one-sided: a modern candidate records `false`/`null` deliberately, so reading
      // those as absent here would manufacture lost-default findings for genuinely-defaulted args.
      !hasDefaultValue(candidateEntry)
    ) {
      violations.push({
        arg,
        kind: 'lost-default',
        message: `the baseline records a default value (${describeDefault(baseEntry)}) but the candidate has none`,
      });
    }
    violations.push(...compareTypeSummary(arg, baseEntry, candidateEntry, options));
    violations.push(...compareRequired(arg, baseEntry, candidateEntry, options));
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
 * Whether an arg records a default value.
 *
 * `legacyBaseline` waives the defaults the legacy Angular extractor invents, so pass it only for an
 * entry that pipeline recorded.
 */
export const hasDefaultValue = (entry: StrictInputType, legacyBaseline = false): boolean =>
  entry.defaultValue !== undefined ||
  isRecordedSummary(entry.table?.defaultValue?.summary, legacyBaseline);

// The legacy Angular extractor invents `NaN` and `false` defaults for members that have none, and a
// JSON round-trip writes that `NaN` as `null`. A legacy baseline cannot tell those apart from real
// defaults, so it waives all three; a candidate that stops inventing them loses nothing.
const isRecordedSummary = (summary: unknown, legacyBaseline: boolean): boolean => {
  if (summary === undefined) {
    return false;
  }
  if (!legacyBaseline) {
    return true;
  }
  return (
    summary !== null && summary !== false && !(typeof summary === 'number' && Number.isNaN(summary))
  );
};

// `table.type` is loosely typed upstream and a recorded corpus can carry anything in it, hence the
// unknown-safe reads.
function compareTypeSummary(
  arg: string,
  baseEntry: StrictInputType,
  candidateEntry: StrictInputType,
  options: CompareArgTypesOptions
): Violation[] {
  const violations: Violation[] = [];
  const baseTableType = (baseEntry.table?.type ?? {}) as Record<string, unknown>;
  const candidateTableType = (candidateEntry.table?.type ?? {}) as Record<string, unknown>;
  const baseSummary = recordedTypeSummary(baseTableType.summary);
  const candidateSummary = recordedTypeSummary(candidateTableType.summary);
  if (baseSummary !== undefined && candidateSummary === undefined) {
    violations.push({
      arg,
      kind: 'lost-summary',
      message: `the baseline records table.type.summary ${JSON.stringify(baseSummary)} but the candidate has none`,
    });
  } else if (
    options.strictTable === true &&
    baseSummary !== undefined &&
    candidateSummary !== undefined &&
    baseSummary !== candidateSummary
  ) {
    violations.push({
      arg,
      kind: 'changed-summary',
      message: `table.type.summary changed: baseline ${JSON.stringify(baseSummary)}, candidate ${JSON.stringify(candidateSummary)}`,
    });
  }
  return violations;
}

// `canonicalType` strips `required` so a type-fidelity comparison ignores it, which leaves this the
// only gate on the flag. It reads the sbType because that is where `SBBaseType` declares it.
function compareRequired(
  arg: string,
  baseEntry: StrictInputType,
  candidateEntry: StrictInputType,
  options: CompareArgTypesOptions
): Violation[] {
  if (
    options.strictTable !== true ||
    baseEntry.type?.required !== true ||
    candidateEntry.type?.required === true
  ) {
    return [];
  }
  return [
    {
      arg,
      kind: 'lost-required',
      message: 'the baseline records the arg as required but the candidate does not',
    },
  ];
}

const recordedTypeSummary = (summary: unknown): string | undefined => {
  if (summary === undefined || summary === null) {
    return undefined;
  }
  const text = String(summary);
  return text.trim() === '' ? undefined : text;
};

// Quoted so a recorded default carrying a newline stays on one violation line.
const describeDefault = (entry: StrictInputType): string =>
  entry.defaultValue !== undefined
    ? `defaultValue: ${JSON.stringify(String(entry.defaultValue))}`
    : `table summary: ${JSON.stringify(String(entry.table?.defaultValue?.summary))}`;

const printType = (type: SBType): string => JSON.stringify(canonicalType(type));

// Deep equality after normalization, or an enumerated improvement. Everything lateral fails and is
// accepted only through a reviewed baseline update.
function typeCurrentOrBetter(baseline: SBType, candidate: SBType): boolean {
  if (deepEqual(canonicalType(baseline), canonicalType(candidate))) {
    return true;
  }
  if (baseline.name === 'other') {
    if (candidate.name === 'other') {
      return normalizeLiteral(baseline.value) === normalizeLiteral(candidate.value);
    }
    if (!isQuotedToken(baseline.value)) {
      return resolvesStub(baseline.value, candidate);
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

// The corpus markers for "the engine extracted nothing"; any candidate improves on them.
const UNRESOLVED_STUBS = new Set(['', 'undefined', 'empty-enum']);

// Legacy engines park what they cannot resolve in `other`, so its value is free text naming a real
// type rather than a shape. Reading more than a scalar or single literal out of that text would mean
// guessing at each engine's spelling, so anything else falls through to a reviewed re-record.
//
// Not the perf engine's `isOpaque`, which counts real type names an engine never looked through:
// `undefined` is an extraction-failure marker here and a resolved type name there.
const resolvesStub = (stub: string, candidate: SBType): boolean => {
  const text = stub.trim();
  if (UNRESOLVED_STUBS.has(text)) {
    return true;
  }
  if (candidate.name === 'literal') {
    return normalizeLiteral(candidate.value) === normalizeLiteral(text);
  }
  return isPopulatedStructure(candidate) || text === candidate.name;
};

const isPopulatedStructure = (candidate: SBType): boolean => {
  switch (candidate.name) {
    case 'enum':
    case 'union':
    case 'intersection':
    case 'tuple':
      return candidate.value.length > 0;
    case 'object':
      return Object.keys(candidate.value).length > 0;
    case 'array':
      // An array always carries an element type, so it is never an empty shell.
      return true;
    default:
      return false;
  }
};

// Ignores `required` and `raw` at every level and normalizes literal-ish values.
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

// The corpus records the same member as '"small"', 'small', or a literal member value, so quotes are
// stripped before comparing.
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
