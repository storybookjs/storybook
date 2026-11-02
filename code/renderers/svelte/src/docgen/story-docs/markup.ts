import { parse } from 'svelte/compiler';

import type { ESTreeAST } from '../../svelte-csf/parser/ast.ts';

// Parse story markup on its own. Svelte reads TypeScript in markup only when the source has a
// `<script lang="ts">`, so a TypeScript story file gets one in front, and `offset` maps positions
// back to the markup.
export function parseMarkup(code: string, typescript: boolean) {
  const prefix = typescript ? '<script lang="ts"></script>' : '';
  return { ast: parse(prefix + code, { modern: true }), offset: prefix.length };
}

// The names a destructuring pattern declares.
export function patternNames(pattern: ESTreeAST.Node | null | undefined): string[] {
  switch (pattern?.type) {
    case 'Identifier':
      return [pattern.name];
    // `let:value={{ item }}` holds its pattern as an object or array expression.
    case 'ObjectPattern':
    case 'ObjectExpression':
      return pattern.properties.flatMap((property) =>
        patternNames(
          property.type === 'RestElement' || property.type === 'SpreadElement'
            ? property
            : property.value
        )
      );
    case 'ArrayPattern':
    case 'ArrayExpression':
      return pattern.elements.flatMap((element) => patternNames(element));
    case 'SpreadElement':
    case 'RestElement':
      return patternNames(pattern.argument);
    case 'AssignmentPattern':
      return patternNames(pattern.left);
    default:
      return [];
  }
}

export type Span = { start: number; end: number };
export type Edit = Span & { value: string };

export function span(node: object): Span {
  if (
    'start' in node &&
    typeof node.start === 'number' &&
    'end' in node &&
    typeof node.end === 'number'
  ) {
    return { start: node.start, end: node.end };
  }
  throw new TypeError('Svelte AST node has no source positions');
}

export function applyEdits(code: string, edits: Edit[]): string {
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    code = code.slice(0, edit.start) + edit.value + code.slice(edit.end);
  }
  return code;
}

// The file name that makes csf-tools parse a script in the story file's language.
export const scriptFile = (typescript: boolean) => (typescript ? 'script.ts' : 'script.js');
