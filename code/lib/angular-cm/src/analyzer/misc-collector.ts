import type * as ts from 'typescript';

import type { EnumType, EnumTypeChild, TypeAlias } from '@storybook/angular-compodoc';
import type { AngularFileMeta } from '../types.ts';
import type { AnalyzerContext } from './context.ts';
import { memberName } from './members.ts';
import { renderTypeNode } from './type-renderer.ts';

// Entries are deduped by name because the argTypes extractor resolves `type` strings against
// `miscellaneous` by name only.
export class MiscCollector {
  private readonly typealiases = new Map<string, TypeAlias>();
  private readonly enumerations = new Map<string, EnumType>();
  private readonly aliasCycleGuard = new Set<string>();

  /**
   * `referencedAs` is the spelling the rendered type text uses, which an import rename makes
   * differ from the declaration's own name. The extractor resolves `type` strings against these
   * entries by name, so the entry has to answer to the spelling the props table shows.
   */
  addFromSymbol(ctx: AnalyzerContext, symbol: ts.Symbol, referencedAs?: string): void {
    const target =
      symbol.flags & ctx.ts.SymbolFlags.Alias ? ctx.checker.getAliasedSymbol(symbol) : symbol;
    for (const declaration of target.declarations ?? []) {
      this.addDeclaration(ctx, declaration, referencedAs);
    }
  }

  // Checker-derived types have no TypeNode to walk, so the type's own symbol and each union
  // constituent's are fed in directly.
  addFromType(ctx: AnalyzerContext, type: ts.Type): void {
    const feed = (candidate: ts.Type) => {
      const symbol = candidate.aliasSymbol ?? candidate.getSymbol();
      if (symbol) {
        this.addFromSymbol(ctx, symbol);
      }
    };
    feed(type);
    if (type.isUnion()) {
      for (const constituent of type.types) {
        feed(constituent);
      }
    }
  }

  addDeclaration(ctx: AnalyzerContext, declaration: ts.Declaration, referencedAs?: string): void {
    // Skipping declaration files keeps lib and `node_modules` helper aliases out of the tables.
    if (declaration.getSourceFile().isDeclarationFile) {
      return;
    }
    if (ctx.ts.isEnumDeclaration(declaration)) {
      this.addEnum(ctx, declaration, referencedAs ?? declaration.name.text);
    } else if (ctx.ts.isTypeAliasDeclaration(declaration)) {
      this.addTypeAlias(ctx, declaration, referencedAs ?? declaration.name.text);
    }
  }

  toMiscellaneous(): AngularFileMeta['miscellaneous'] {
    const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
    return {
      typealiases: [...this.typealiases.values()].sort(byName),
      enumerations: [...this.enumerations.values()].sort(byName),
    };
  }

  private addEnum(ctx: AnalyzerContext, declaration: ts.EnumDeclaration, name: string): void {
    if (this.enumerations.has(name)) {
      return;
    }
    const childs = declaration.members.map((member): EnumTypeChild => {
      const value = enumMemberValue(ctx, member.initializer);
      return {
        name: memberName(ctx, member.name),
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

  private addTypeAlias(
    ctx: AnalyzerContext,
    declaration: ts.TypeAliasDeclaration,
    name: string
  ): void {
    if (this.typealiases.has(name) || this.aliasCycleGuard.has(name)) {
      return;
    }
    this.aliasCycleGuard.add(name);
    const rawtype = renderTypeNode(ctx, declaration.type);
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
}

// Compodoc parity: numeric initializers stay numbers, so a `0` member is falsy and correctly
// disables the extractor's enum path.
const enumMemberValue = (
  ctx: AnalyzerContext,
  initializer: ts.Expression | undefined
): string | number | undefined => {
  if (!initializer) {
    return undefined;
  }
  if (ctx.ts.isStringLiteral(initializer) || ctx.ts.isNoSubstitutionTemplateLiteral(initializer)) {
    return initializer.text;
  }
  if (ctx.ts.isNumericLiteral(initializer)) {
    return Number(initializer.text);
  }
  return undefined;
};
