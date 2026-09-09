/**
 * Server-side resolution of named type references to declaration-member text, emitted as
 * `table.type.detail` (spec: "ArgsTable named-type properties", storybookjs/storybook#13459).
 *
 * Constructed per docgen-server payload from the worker's warm `vue-component-meta` checker,
 * whose `getProgram()` exposes the full underlying TypeScript program. The legacy Vite-plugin
 * path never constructs one, so its output stays byte-identical to today.
 *
 * The expansion is deliberately bounded: one hop (property types render as their text form),
 * at most 20 property lines, nothing declared in node_modules or ambient .d.ts files, and no
 * recursion — a `parent: User` line renders as text instead of expanding `User` again.
 */
import { slash } from 'storybook/internal/common';

import type ts from 'typescript';
import type { ComponentMetaChecker } from 'vue-component-meta';

/** Property lines shown before the remainder is summarized as an "… N more" line. */
export const MAX_DETAIL_LINES = 20;

/**
 * Plain type names only — qualified (`MyNamespace.User`) or not. Everything else (inline object
 * literals, unions, arrays like `User[]`, `typeof X`) stays flat, matching today's output.
 */
const TYPE_NAME_PATTERN = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;

/** Resolves a prop's named type reference to its `table.type.detail` text, or undefined when the type stays flat. */
export type NamedTypeDetailResolver = (typeName: string) => string | undefined;

/** Builds the resolver for one component's docgen extraction, bound to that component's checker. */
export function createNamedTypeDetailResolver({
  checker,
  typescript,
  componentPath,
}: {
  checker: ComponentMetaChecker;
  typescript: typeof ts;
  componentPath: string;
}): NamedTypeDetailResolver {
  const program = checker.getProgram();
  const location = program?.getSourceFile(slash(componentPath));
  if (!program || !location) {
    return () => undefined;
  }
  const typeChecker = program.getTypeChecker();

  const unwrapAlias = (symbol: ts.Symbol): ts.Symbol =>
    symbol.flags & typescript.SymbolFlags.Alias ? typeChecker.getAliasedSymbol(symbol) : symbol;

  /** Resolves `MyNamespace.User`-style names in the component file's scope, imports included. */
  const resolveQualifiedName = (name: string): ts.Symbol | undefined => {
    const [head, ...rest] = name.split('.');
    let symbol = typeChecker.resolveName(
      head,
      location,
      typescript.SymbolFlags.Type | typescript.SymbolFlags.Namespace,
      false
    );
    for (const segment of rest) {
      if (!symbol) {
        return undefined;
      }
      // getAliasedSymbol turns an `import * as NS` alias into the module symbol that carries
      // the exports; local namespaces carry them directly. SymbolTable keys are TS's branded
      // __String, which a plain string is runtime-compatible with.
      symbol = unwrapAlias(symbol).exports?.get(segment as ts.__String);
    }
    return symbol;
  };

  const capLines = (lines: string[]): string[] => {
    if (lines.length <= MAX_DETAIL_LINES) {
      return lines;
    }
    return [...lines.slice(0, MAX_DETAIL_LINES), `… ${lines.length - MAX_DETAIL_LINES} more`];
  };

  /** An empty member set (index-signature-only types, empty enums) stays flat. */
  const renderMembers = (name: string, lines: string[]): string | undefined =>
    lines.length > 0 ? [`${name} {`, ...capLines(lines), '}'].join('\n') : undefined;

  const renderObject = (name: string, type: ts.Type): string | undefined =>
    renderMembers(
      name,
      type.getProperties().map((property) => {
        const typeText = typeChecker
          .typeToString(typeChecker.getTypeOfSymbol(property))
          .replace(/ \| undefined$/, '');
        return `  ${property.getName()}: ${typeText}`;
      })
    );

  const renderEnum = (name: string, declaration: ts.EnumDeclaration): string | undefined =>
    renderMembers(
      name,
      declaration.members.map((member) => {
        const value = typeChecker.getConstantValue(member) ?? member.initializer?.getText();
        return value === undefined
          ? `  ${member.name.getText()}`
          : `  ${member.name.getText()} = ${typeof value === 'string' ? `'${value}'` : value}`;
      })
    );

  return (typeName) => {
    if (!TYPE_NAME_PATTERN.test(typeName)) {
      return undefined;
    }
    const symbol = resolveQualifiedName(typeName);
    if (!symbol) {
      return undefined;
    }
    const realSymbol = unwrapAlias(symbol);
    const declaration = realSymbol.declarations?.[0];
    if (!declaration) {
      return undefined;
    }

    const declaringFile = declaration.getSourceFile();
    // Library types (node_modules, ambient .d.ts) stay flat: no library-type noise in payloads.
    if (declaringFile.isDeclarationFile || declaringFile.fileName.includes('node_modules')) {
      return undefined;
    }

    if (typescript.isEnumDeclaration(declaration)) {
      return renderEnum(typeName, declaration);
    }
    if (typescript.isInterfaceDeclaration(declaration)) {
      return renderObject(typeName, typeChecker.getDeclaredTypeOfSymbol(realSymbol));
    }
    if (typescript.isTypeAliasDeclaration(declaration)) {
      // The checker resolves the whole alias chain here and degrades circular aliases to `any`,
      // so resolution terminates and an unresolvable chain simply has no members to render.
      const resolved = typeChecker.getTypeAtLocation(declaration.type);
      return resolved.flags & typescript.TypeFlags.Object
        ? renderObject(typeName, resolved)
        : undefined;
    }
    return undefined;
  };
}
