/**
 * The pinned one-hop detail text for a named type reference: interface and object-shape alias
 * properties render as `name: typeText` lines, enum members as `Name = value` lines, all inside a
 * `Name {` / `}` frame.
 *
 * Bounded by construction: the reference resolves through the analyzer's file scope, alias chains
 * walk with a seen-guard, declarations outside the project (lib, `node_modules`, any `.d.ts`) never
 * expand, and member types render as their text form — one hop, never recursively.
 */
import { isInNodeModules } from 'storybook/internal/common';

import type * as ts from 'typescript';

import { resolvedNameSymbol, type AnalyzerContext } from './analyzer/context.ts';
import { getJsDocDescription } from './analyzer/jsdoc.ts';

/** Member lines the detail carries before the `… N more` line. */
const DETAIL_LINE_CAP = 20;

// A bare identifier is the only spelling the pinned format expands: unions, functions, generics,
// and qualified names keep today's flat behavior.
const isBareTypeName = (type: string): boolean => /^[A-Za-z_$][\w$]*$/.test(type);

export const namedTypeDetail = (context: AnalyzerContext, type: string): string | undefined => {
  if (!isBareTypeName(type)) {
    return undefined;
  }
  const { ts } = context;
  // The alias chain's seen-guard: `type A = B; type B = A` stops here instead of looping.
  const walked = new Set<string>();
  let symbol = resolvedNameSymbol(context, type);
  while (symbol) {
    // The project boundary: a dependency's types stay flat, keeping payloads free of library-type
    // noise.
    const declaration = symbol.declarations?.find(
      (candidate) =>
        !candidate.getSourceFile().isDeclarationFile &&
        !isInNodeModules(candidate.getSourceFile().fileName)
    );
    if (!declaration) {
      return undefined;
    }
    if (ts.isEnumDeclaration(declaration)) {
      return enumDetail(context, type, declaration);
    }
    if (ts.isInterfaceDeclaration(declaration)) {
      return objectDetail(context, type, declaration.members);
    }
    if (ts.isTypeAliasDeclaration(declaration)) {
      if (walked.has(declaration.name.text)) {
        return undefined;
      }
      walked.add(declaration.name.text);
      if (ts.isTypeLiteralNode(declaration.type)) {
        return objectDetail(context, type, declaration.type.members);
      }
      if (ts.isTypeReferenceNode(declaration.type) && ts.isIdentifier(declaration.type.typeName)) {
        symbol = resolvedNameSymbol(context, declaration.type.typeName.text);
        continue;
      }
      return undefined;
    }
    return undefined;
  }
  return undefined;
};

const detailLines = (lines: string[]): string[] =>
  lines.length > DETAIL_LINE_CAP
    ? [
        ...lines.slice(0, DETAIL_LINE_CAP).map((line) => `  ${line}`),
        `… ${lines.length - DETAIL_LINE_CAP} more`,
      ]
    : lines.map((line) => `  ${line}`);

// jsdoc is appended only when in hand: reading the declaration this loop already walked costs no
// resolution, so the description rides along — otherwise the line stays bare.
const describedLine = (context: AnalyzerContext, line: string, node: ts.Node): string => {
  const { rawdescription } = getJsDocDescription(context.ts, node);
  return rawdescription === undefined ? line : `${line} — ${rawdescription}`;
};

const objectDetail = (
  context: AnalyzerContext,
  header: string,
  members: ts.NodeArray<ts.TypeElement> | undefined
): string | undefined => {
  const { ts, types } = context;
  if (!members) {
    return undefined;
  }
  const lines: string[] = [];
  for (const member of members) {
    if (!ts.isPropertySignature(member) || member.type === undefined) {
      continue;
    }
    const optional = member.questionToken ? '?' : '';
    lines.push(
      describedLine(
        context,
        `${member.name.getText()}${optional}: ${types.render(member.type)}`,
        member
      )
    );
  }
  return lines.length === 0 ? undefined : `${header} {\n${detailLines(lines).join('\n')}\n}`;
};

const enumDetail = (
  context: AnalyzerContext,
  header: string,
  declaration: ts.EnumDeclaration
): string | undefined => {
  const lines: string[] = [];
  for (const member of declaration.members) {
    // The initializer's own source text, so a string member keeps its original quoting; a member
    // with none (auto-incremented) renders bare rather than inventing a value.
    const value = member.initializer?.getText();
    lines.push(
      describedLine(context, `${member.name.getText()}${value ? ` = ${value}` : ''}`, member)
    );
  }
  return lines.length === 0 ? undefined : `${header} {\n${detailLines(lines).join('\n')}\n}`;
};
