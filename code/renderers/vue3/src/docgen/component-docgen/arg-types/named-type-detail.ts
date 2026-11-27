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

/** Declarations outside the user's project (dependencies, ambient .d.ts) never expand. */
const isExternalFile = (file: ts.SourceFile): boolean =>
  file.isDeclarationFile || file.fileName.includes('node_modules');

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
        // Optional members render as written (`theme?: string`): the checker folds the
        // optionality into the type as `| undefined`, which would duplicate what the `?`
        // marker already says. Strip that checker-added trailing undefined only when the
        // symbol is optional; explicitly-declared unions keep their text verbatim.
        const isOptional = !!(property.flags & typescript.SymbolFlags.Optional);
        const rawTypeText = typeChecker.typeToString(typeChecker.getTypeOfSymbol(property));
        const strippedTypeText = rawTypeText.replace(/\s*\|\s*undefined$/, '');
        const typeText = isOptional ? strippedTypeText || rawTypeText : rawTypeText;
        // Member JSDoc is documentation the checker already holds — no extra resolution pass.
        const description = typescript
          .displayPartsToString(property.getDocumentationComment(typeChecker))
          .replace(/\s+/g, ' ')
          .trim();
        return `  ${property.getName()}${isOptional ? '?' : ''}: ${typeText}${
          description ? ` — ${description}` : ''
        }`;
      })
    );

  const renderEnum = (name: string, declaration: ts.EnumDeclaration): string | undefined =>
    renderMembers(
      name,
      declaration.members.map((member) => {
        const memberName = member.name.getText();
        const constantValue = typeChecker.getConstantValue(member);
        if (typeof constantValue === 'string') {
          return `  ${memberName} = '${constantValue.replace(/'/g, "\\'")}'`;
        }
        if (typeof constantValue === 'number') {
          return `  ${memberName} = ${constantValue}`;
        }
        const initializer = member.initializer?.getText();
        return initializer ? `  ${memberName} = ${initializer}` : `  ${memberName}`;
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

    // Library types (node_modules, ambient .d.ts) stay flat: no library-type noise in payloads.
    // Every declaration must be in-project: declaration merging can add ambient members to a
    // locally-declared interface.
    if (realSymbol.declarations?.some((d) => isExternalFile(d.getSourceFile()))) {
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
      if (!(resolved.flags & typescript.TypeFlags.Object)) {
        return undefined;
      }
      // Judge expansion by where the members are declared, not by the resolved symbol: lib.d.ts
      // declares the mapped type itself, so `type Picked = Pick<User, 'name'>` resolves to an
      // external symbol even though its members are the user's in-project properties and must
      // still expand. A local alias naming a library type (`type LocalDate = Date`) has only
      // externally-declared members and stays flat. Members without declarations count as
      // external — anything unverifiable stays flat.
      const members = typeChecker.getPropertiesOfType(resolved);
      const allMembersExternal = members.every(
        (member) => member.declarations?.some((d) => isExternalFile(d.getSourceFile())) ?? true
      );
      if (allMembersExternal) {
        return undefined;
      }
      return renderObject(typeName, resolved);
    }
    return undefined;
  };
}
