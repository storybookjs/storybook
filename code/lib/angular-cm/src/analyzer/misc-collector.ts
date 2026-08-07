import type * as ts from 'typescript';

import type { EnumType, EnumTypeChild, TypeAlias } from '@storybook/angular-compodoc';
import type { AngularFileMeta } from '../types.ts';
import type { AnalyzerContext } from './context.ts';
import { memberName } from './members.ts';
import { renderTypeNode } from './type-renderer.ts';

/**
 * Collects the enums and type aliases the analyzed types refer to, deduped by name - the argTypes
 * extractor resolves `type` strings against `miscellaneous` by name only. Declaration files are
 * skipped so lib/`node_modules` helper aliases (`Partial`, …) do not pollute the lookup tables.
 */
export class MiscCollector {
  private readonly typealiases = new Map<string, TypeAlias>();
  private readonly enumerations = new Map<string, EnumType>();
  /** Guards alias cycles (`type A = B; type B = A`): rendering A's target re-enters for A. */
  private readonly inProgress = new Set<string>();

  addFromSymbol(ctx: AnalyzerContext, symbol: ts.Symbol): void {
    const target =
      symbol.flags & ctx.ts.SymbolFlags.Alias ? ctx.checker.getAliasedSymbol(symbol) : symbol;
    for (const declaration of target.declarations ?? []) {
      this.addDeclaration(ctx, declaration);
    }
  }

  /**
   * Feed for checker-derived types, which have no TypeNode to walk: the type's alias or enum
   * symbol, and each union constituent's, so the names the type string mentions resolve by name in
   * `miscellaneous`.
   */
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

  addDeclaration(ctx: AnalyzerContext, declaration: ts.Declaration): void {
    if (declaration.getSourceFile().isDeclarationFile) {
      return;
    }
    if (ctx.ts.isEnumDeclaration(declaration)) {
      this.addEnum(ctx, declaration);
    } else if (ctx.ts.isTypeAliasDeclaration(declaration)) {
      this.addTypeAlias(ctx, declaration);
    }
  }

  toMiscellaneous(): AngularFileMeta['miscellaneous'] {
    const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
    return {
      typealiases: [...this.typealiases.values()].sort(byName),
      enumerations: [...this.enumerations.values()].sort(byName),
    };
  }

  private addEnum(ctx: AnalyzerContext, declaration: ts.EnumDeclaration): void {
    const name = declaration.name.text;
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

  private addTypeAlias(ctx: AnalyzerContext, declaration: ts.TypeAliasDeclaration): void {
    const name = declaration.name.text;
    if (this.typealiases.has(name) || this.inProgress.has(name)) {
      return;
    }
    this.inProgress.add(name);
    // Rendering the target recurses back into this collector for every type reference in it.
    const rawtype = renderTypeNode(ctx, declaration.type);
    this.inProgress.delete(name);
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

/**
 * Compodoc parity: literal initializers only, with numeric ones kept as numbers so a `0` member
 * stays falsy and correctly disables the extractor's enum path.
 */
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
