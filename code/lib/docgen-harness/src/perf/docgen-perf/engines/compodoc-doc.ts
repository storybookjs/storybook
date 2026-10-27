/**
 * Reading compodoc's `documentation.json`.
 *
 * Compodoc records how much it documented and how much of it it actually resolved, which is what
 * makes its timings readable: it never expands a named type, so a chain of aliases costs it nothing
 * and it still reports every member. Counting members alone would let it look equal to an engine
 * that did far more work.
 */
import * as fs from 'node:fs';

interface MemberEntry {
  type?: string;
  subProperties?: unknown[];
}

interface MemberHolder {
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

/**
 * `classes` is deliberately left out. Compodoc copies an ancestor's members into every descendant's
 * own arrays, so a base class documented under `classes` would be counted a second time. This also
 * matches what Storybook reads, which is a component's own four arrays.
 */
function documentedMembers(doc: Documentation): MemberEntry[] {
  return [...(doc.components ?? []), ...(doc.directives ?? [])].flatMap((holder) =>
    MEMBER_ARRAYS.flatMap((key) => holder[key] ?? [])
  );
}

/**
 * Names that describe themselves, so recording one is not a resolution an engine skipped. Keyword
 * spellings are lowercase as compodoc emits them (`function`, not `Function`); both are listed
 * because the two spellings reach the same member field.
 */
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

/**
 * A member whose type is a bare name the engine never looked through - `Hop19Shape`, not
 * `{ x: string }`. Inline object literals, primitives and literal unions are all self-describing,
 * so only a lone identifier counts.
 *
 * This is a floor: wrapped forms such as `Partial<Shape>` are equally unresolved but do not match,
 * so the true share of unresolved types is at least what this reports.
 */
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

export function countDocumentation(documentationJsonPath: string): DocumentationCounts {
  const doc = JSON.parse(fs.readFileSync(documentationJsonPath, 'utf8')) as Documentation;
  const members = documentedMembers(doc);
  return { members: members.length, opaqueTypes: members.filter(isOpaque).length };
}
