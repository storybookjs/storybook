import type { SBType } from '../../../../core/src/csf/SBType.ts';
import type { StrictArgTypes, StrictInputType } from '../../../../core/src/csf/story.ts';
import type { Violation } from './types.ts';

export interface CompareArgTypesOptions {
  /**
   * The baseline is a legacy compodoc recording, whose invented defaults (raw `false`, `NaN`, and
   * `NaN`'s JSON round-trip `null`) must not be ratcheted. Only for legs whose baseline files the
   * legacy Angular pipeline recorded; every other comparison treats those values as real defaults.
   */
  legacyBaseline?: boolean;
  /**
   * Additionally flag `table.type.summary` text changes and `table.type.required` true->false
   * flips. Only for legs whose baseline the same engine recorded (the ACM self-ratchet), where the
   * recorded table values are trustworthy rather than legacy fabrications (#28706).
   */
  strictTable?: boolean;
}

/**
 * Deliberate pass-list: the comparator never flags description or default CONTENT changes,
 * `table.category`, `control`, `action`, per-arg `jsDocTags`, candidate-only (added) args, or enum
 * supersets. `required` and `table.type.summary` text changes pass except under `strictTable`.
 * Everything on that list is either engine-specific vocabulary or a recorded legacy lie (#28706);
 * changes to it are reviewed through the byte-exact snapshot diffs, not machine-gated here.
 */
export function compareArgTypes(
  baseline: StrictArgTypes,
  candidate: StrictArgTypes,
  options: CompareArgTypesOptions = {}
): Violation[] {
  const violations: Violation[] = [];
  for (const [arg, baseEntry] of Object.entries(baseline)) {
    // ES-private `#member`s are inaccessible outside their class; legacy Compodoc records them
    // anyway, and the modern extractor deliberately drops them. Their loss never gates.
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
      // The invented-default waiver describes the LEGACY side only: a modern candidate records
      // `false`/`null` deliberately, so treating those as absent here manufactured lost-default
      // findings for genuinely-defaulted args (18 of bitwarden's 54 findings).
      !hasDefaultValue(candidateEntry, false)
    ) {
      violations.push({
        arg,
        kind: 'lost-default',
        message: `the baseline records a default value (${describeDefault(baseEntry)}) but the candidate has none`,
      });
    }
    violations.push(...compareTypeSummary(arg, baseEntry, candidateEntry, options));
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

const hasDefaultValue = (entry: StrictInputType, legacyBaseline: boolean): boolean =>
  entry.defaultValue !== undefined ||
  isRecordedSummary(entry.table?.defaultValue?.summary, legacyBaseline);

/**
 * Whether a `table.defaultValue.summary` records a real default. The legacy Angular extractor
 * invents defaults for members that have none - `NaN` from `Number(undefined)` / `Number('expr')`
 * and boolean `false` from `undefined === 'true'` - which the no-invented-NaN gap marker
 * (angular-legacy-gaps.test.ts) pins as fabrications, and a JSON round-trip (the sandbox
 * baselines) writes that `NaN` as `null`. In a legacy compodoc baseline those raw values are
 * indistinguishable from their invented counterpart, so `legacyBaseline` waives them there: a
 * candidate that stops inventing them loses nothing. Everywhere else the recording engine writes
 * raw `false` / `null` only for genuine defaults, so only `undefined` counts as absent.
 */
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

/**
 * `table.type.summary` drops are violations in every mode; text changes only under `strictTable`,
 * alongside `table.type.required` true->false flips. `table.type` is loosely typed upstream
 * (`required` is a corpus field the csf type does not declare), hence the unknown-safe reads.
 */
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
  if (
    options.strictTable === true &&
    baseTableType.required === true &&
    candidateTableType.required !== true
  ) {
    violations.push({
      arg,
      kind: 'lost-required',
      message: 'the baseline records table.type.required true but the candidate does not',
    });
  }
  return violations;
}

/** A summary counts as recorded when it stringifies to non-whitespace text. */
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

/** The corpus markers for "the engine extracted nothing"; any candidate improves on them. */
const UNRESOLVED_STUBS = new Set(['', 'undefined', 'empty-enum']);

/**
 * Legacy engines park whatever they cannot resolve in `other`, so its value is free text naming a
 * real type rather than a shape. A candidate improves on it by adding populated structure or by
 * resolving it to the scalar or single literal it already named; an unrelated scalar, an unrelated
 * literal, or an EMPTY structure (enum/union/intersection/tuple with no members, object with no
 * keys) is a lateral change. Reading more out of the text would mean guessing at each engine's
 * spelling, so a resolution the rule cannot recognize fails and is accepted through a reviewed
 * re-record - the harness's normal acceptance path.
 */
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
