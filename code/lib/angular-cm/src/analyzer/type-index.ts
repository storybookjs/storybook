import type * as tsModule from 'typescript';

import type { EnumType, EnumTypeChild, TypeAlias } from '../types.ts';
import type { AngularFileMeta } from '../types.ts';
import { memberName } from './node-text.ts';

// The checker qualifies out-of-scope symbols as `import("@angular/core").Signal<...>`; the props
// table wants the bare name.
export const stripImportQualifiers = (text: string): string =>
  text.replace(/import\("[^"]*"\)\./g, '');

const collapseWhitespace = (text: string): string => text.replace(/\s+/g, ' ').trim();

/**
 * Renders type text and records the named types that text mentions.
 *
 * The two halves are one object because they have to agree on the key: the extractor resolves a
 * member's `type` string against `miscellaneous` by name alone, so an entry filed under a name the
 * rendered text never uses can never be found.
 */
export class TypeIndex {
  private readonly typealiases = new Map<string, TypeAlias>();
  private readonly enumerations = new Map<string, EnumType>();
  private readonly aliasCycleGuard = new Set<string>();

  constructor(
    private readonly ts: typeof tsModule,
    private readonly checker: tsModule.TypeChecker
  ) {}

  /**
   * Render a type node to the spelling the props table shows.
   *
   * Syntactic on purpose, to match the spellings the argTypes extractor depends on: string
   * literals double-quoted, unions joined with ` | `.
   */
  render(typeNode: tsModule.TypeNode): string {
    const { ts } = this;
    if (ts.isLiteralTypeNode(typeNode)) {
      const { literal } = typeNode;
      if (ts.isStringLiteral(literal) || ts.isNoSubstitutionTemplateLiteral(literal)) {
        // JSON.stringify keeps embedded quotes/backslashes parseable for the enum fallback.
        return JSON.stringify(literal.text);
      }
      return literal.getText();
    }
    if (ts.isUnionTypeNode(typeNode)) {
      return typeNode.types.map((type) => this.render(type)).join(' | ');
    }
    if (ts.isIntersectionTypeNode(typeNode)) {
      return typeNode.types.map((type) => this.render(type)).join(' & ');
    }
    if (ts.isArrayTypeNode(typeNode)) {
      return `${this.render(typeNode.elementType)}[]`;
    }
    if (ts.isTupleTypeNode(typeNode)) {
      return `[${typeNode.elements.map((element) => this.render(element)).join(', ')}]`;
    }
    if (ts.isParenthesizedTypeNode(typeNode)) {
      return `(${this.render(typeNode.type)})`;
    }
    if (ts.isFunctionTypeNode(typeNode) || ts.isConstructorTypeNode(typeNode)) {
      // A real signature rather than a bare `function`; `isFunctionTypeString` still matches an
      // arrow signature, so the function control survives.
      const typeParameters = typeNode.typeParameters?.length
        ? `<${typeNode.typeParameters.map((parameter) => parameter.getText()).join(', ')}>`
        : '';
      const parameters = typeNode.parameters
        .map((parameter) => {
          const name = parameter.name.getText();
          const rest = parameter.dotDotDotToken ? '...' : '';
          const optional = parameter.questionToken ? '?' : '';
          const type = parameter.type ? this.render(parameter.type) : 'any';
          return `${rest}${name}${optional}: ${type}`;
        })
        .join(', ');
      const prefix = ts.isConstructorTypeNode(typeNode) ? 'new ' : '';
      return `${prefix}${typeParameters}(${parameters}) => ${this.render(typeNode.type)}`;
    }
    if (ts.isTypeOperatorNode(typeNode)) {
      const operator =
        typeNode.operator === ts.SyntaxKind.KeyOfKeyword
          ? 'keyof'
          : typeNode.operator === ts.SyntaxKind.ReadonlyKeyword
            ? 'readonly'
            : 'unique';
      return `${operator} ${this.render(typeNode.type)}`;
    }
    if (ts.isIndexedAccessTypeNode(typeNode)) {
      return `${this.render(typeNode.objectType)}[${this.render(typeNode.indexType)}]`;
    }
    if (ts.isTypeReferenceNode(typeNode)) {
      const name = typeNode.typeName.getText();
      const symbol = this.checker.getSymbolAtLocation(typeNode.typeName);
      if (symbol) {
        this.addFromSymbol(symbol, name);
      }
      const args = typeNode.typeArguments?.length
        ? `<${typeNode.typeArguments.map((arg) => this.render(arg)).join(', ')}>`
        : '';
      return `${name}${args}`;
    }
    return collapseWhitespace(typeNode.getText());
  }

  /** Widen and render a declaration's inferred type, as the legacy pipeline did (`'v1'` to `string`). */
  infer(node: tsModule.NamedDeclaration): string | undefined {
    const { checker, ts } = this;
    if (!node.name) {
      return undefined;
    }
    const symbol = checker.getSymbolAtLocation(node.name);
    if (!symbol) {
      return undefined;
    }
    const type = checker.getBaseTypeOfLiteralType(checker.getTypeOfSymbolAtLocation(symbol, node));
    this.addFromType(type);
    return stripImportQualifiers(checker.typeToString(type, node, ts.TypeFormatFlags.NoTruncation));
  }

  // Checker-derived types have no TypeNode to walk, so the type's own symbol and each union
  // constituent's are fed in directly.
  addFromType(type: tsModule.Type): void {
    const feed = (candidate: tsModule.Type) => {
      const symbol = candidate.aliasSymbol ?? candidate.getSymbol();
      if (symbol) {
        this.addFromSymbol(symbol);
      }
    };
    feed(type);
    if (type.isUnion()) {
      for (const constituent of type.types) {
        feed(constituent);
      }
    }
  }

  addDeclaration(declaration: tsModule.Declaration, referencedAs?: string): void {
    // Skipping declaration files keeps lib and `node_modules` helper aliases out of the tables.
    if (declaration.getSourceFile().isDeclarationFile) {
      return;
    }
    if (this.ts.isEnumDeclaration(declaration)) {
      this.addEnum(declaration, referencedAs ?? declaration.name.text);
    } else if (this.ts.isTypeAliasDeclaration(declaration)) {
      this.addTypeAlias(declaration, referencedAs ?? declaration.name.text);
    }
  }

  toMiscellaneous(): AngularFileMeta['miscellaneous'] {
    const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
    return {
      typealiases: [...this.typealiases.values()].sort(byName),
      enumerations: [...this.enumerations.values()].sort(byName),
    };
  }

  /**
   * `referencedAs` is the spelling {@link render} produced, which an import rename makes differ from
   * the declaration's own name.
   */
  private addFromSymbol(symbol: tsModule.Symbol, referencedAs?: string): void {
    const target =
      symbol.flags & this.ts.SymbolFlags.Alias ? this.checker.getAliasedSymbol(symbol) : symbol;
    for (const declaration of target.declarations ?? []) {
      this.addDeclaration(declaration, referencedAs);
    }
  }

  private addEnum(declaration: tsModule.EnumDeclaration, name: string): void {
    if (this.enumerations.has(name)) {
      return;
    }
    const childs = declaration.members.map((member): EnumTypeChild => {
      const value = this.enumMemberValue(member.initializer);
      return {
        name: memberName(this.ts, member.name),
        ...(value === undefined ? {} : { value }),
      };
    });
    this.enumerations.set(name, {
      name,
      childs,
      ctype: 'miscellaneous',
      subtype: 'enum',
      file: declaration.getSourceFile().fileName,
    });
  }

  private addTypeAlias(declaration: tsModule.TypeAliasDeclaration, name: string): void {
    if (this.typealiases.has(name) || this.aliasCycleGuard.has(name)) {
      return;
    }
    this.aliasCycleGuard.add(name);
    const rawtype = this.render(declaration.type);
    this.aliasCycleGuard.delete(name);
    this.typealiases.set(name, {
      name,
      ctype: 'miscellaneous',
      subtype: 'typealias',
      rawtype,
      file: declaration.getSourceFile().fileName,
      kind: declaration.type.kind,
    });
  }

  // Numeric initializers stay numbers, so a `0` member is falsy and correctly disables the
  // extractor's enum path.
  private enumMemberValue(
    initializer: tsModule.Expression | undefined
  ): string | number | undefined {
    const { ts } = this;
    if (!initializer) {
      return undefined;
    }
    if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
      return initializer.text;
    }
    if (ts.isNumericLiteral(initializer)) {
      return Number(initializer.text);
    }
    return undefined;
  }
}
