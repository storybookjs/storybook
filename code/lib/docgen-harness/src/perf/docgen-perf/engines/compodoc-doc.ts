// Compodoc never expands a named type, so a chain of aliases costs it nothing while it still reports
// every member. Counting members alone would let it look equal to an engine that did far more work,
// which is why the opaque-type count is read alongside them.
import * as fs from 'node:fs';

interface MemberEntry {
  name?: string;
  type?: string;
  subProperties?: unknown[];
}

// Exported so the angular-component-meta engine counts its entries through `countMembers` too: the
// pair's like-for-like verdict rests on both sides being counted by one rule.
export interface MemberHolder {
  inputsClass?: MemberEntry[];
  outputsClass?: MemberEntry[];
  propertiesClass?: MemberEntry[];
  methodsClass?: MemberEntry[];
}

interface Documentation {
  components?: MemberHolder[];
  directives?: MemberHolder[];
}

const MEMBER_ARRAYS = ['inputsClass', 'outputsClass', 'propertiesClass', 'methodsClass'] as const;

// `classes` is deliberately left out: compodoc copies an ancestor's members into every descendant's
// own arrays, so a base class documented there would be counted a second time.
function documentedHolders(doc: Documentation): MemberHolder[] {
  return [...(doc.components ?? []), ...(doc.directives ?? [])];
}

// Names that describe themselves, so recording one is not a resolution an engine skipped. Both
// spellings of a keyword are listed because they reach the same member field.
const RESOLVED_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'any',
  'unknown',
  'void',
  'never',
  'null',
  'undefined',
  'object',
  'symbol',
  'bigint',
  'function',
  'Date',
  'Function',
  'Array',
  'Object',
]);

// A member whose type is a bare name the engine never looked through. Only a lone identifier counts,
// so wrapped forms like `Partial<Shape>` are missed and the reported share is a floor.
function isOpaque(entry: MemberEntry): boolean {
  if (entry.subProperties?.length || !entry.type) {
    return false;
  }
  const named = entry.type.replace(/\[\]$/, '').trim();
  return /^[A-Za-z_$][\w$]*$/.test(named) && !RESOLVED_TYPES.has(named);
}

export interface DocumentationCounts {
  members: number;
  opaqueTypes: number;
}

export function countMembers(holders: MemberHolder[]): DocumentationCounts {
  const members = holders.flatMap((holder) => MEMBER_ARRAYS.flatMap((key) => holder[key] ?? []));
  return { members: members.length, opaqueTypes: members.filter(isOpaque).length };
}

export function countDocumentation(documentationJsonPath: string): DocumentationCounts {
  const doc = JSON.parse(fs.readFileSync(documentationJsonPath, 'utf8')) as Documentation;
  return countMembers(documentedHolders(doc));
}
