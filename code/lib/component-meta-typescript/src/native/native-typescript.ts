import { existsSync, readFileSync, statSync } from 'node:fs';

import type ts from 'typescript';
import type {
  JSDocSeeTag,
  NamedMemberBase,
  Node,
  TypeParameterDeclaration,
} from 'typescript-native/ast';
import type { API, RetainedSourceFile } from 'typescript-native/sync';

import {
  DOCGEN_NODE_GUARDS,
  type DocgenNodeAccessors,
  type DocgenNodeGuards,
  type DocgenSystem,
  type DocgenTypeScript,
} from '../docgen-typescript.ts';
import { NativeFacades } from './native-facades.ts';

type DocgenNodeGuard = (typeof DOCGEN_NODE_GUARDS)[number];

const NATIVE_GUARD_NAMES: Partial<
  Record<DocgenNodeGuard, keyof typeof import('typescript-native/ast')>
> = {
  isGetAccessor: 'isGetAccessorDeclaration',
  isParameter: 'isParameterDeclaration',
  isPropertySignature: 'isPropertySignatureDeclaration',
  isSetAccessor: 'isSetAccessorDeclaration',
  isTypeAssertionExpression: 'isTypeAssertion',
};

const composedGuards = (
  ast: NativeTypeScriptModules['ast']
): Partial<Record<DocgenNodeGuard, (node: Node) => boolean>> => ({
  isClassLike: (node) => ast.isClassDeclaration(node) || ast.isClassExpression(node),
  isStringLiteralLike: (node) =>
    ast.isStringLiteral(node) || ast.isNoSubstitutionTemplateLiteral(node),
});

const nativeNodeAccessors = (ast: NativeTypeScriptModules['ast']): DocgenNodeAccessors => ({
  getTypeParameterDefault: (node) =>
    (node as unknown as TypeParameterDeclaration).defaultType as unknown as ts.TypeNode | undefined,
  hasQuestionToken: (member) =>
    (member as unknown as Partial<NamedMemberBase>).postfixToken?.kind ===
    ast.SyntaxKind.QuestionToken,
  getSeeTagReference: (tag) =>
    (tag as unknown as JSDocSeeTag).nameExpression as unknown as ts.Node | undefined,
  // A JSDoc node starts at the trivia before it, comments included.
  getJSDocStart: (jsDoc) => {
    const sourceText = jsDoc.getSourceFile().text;
    let at = jsDoc.pos;
    while (at < sourceText.length && !sourceText.startsWith('/**', at)) {
      if (sourceText.startsWith('//', at)) {
        const lineEnd = sourceText.indexOf('\n', at);
        at = lineEnd < 0 ? sourceText.length : lineEnd + 1;
      } else if (sourceText.startsWith('/*', at)) {
        const close = sourceText.indexOf('*/', at + 2);
        at = close < 0 ? sourceText.length : close + 2;
      } else {
        at += 1;
      }
    }
    return at;
  },
  getJSDocTagCommentStart: (tag) => {
    const comment = tag.comment as string | { pos: number };
    const commentStart = typeof comment === 'string' ? tag.end : comment.pos;
    let end = tag.tagName.end;
    const afterPart = (part: { end: number }) => {
      if (part.end <= commentStart) {
        end = Math.max(end, part.end);
      }
    };
    (tag as unknown as Node).forEachChild(afterPart, (parts) => parts.forEach(afterPart));
    return end;
  },
});

export interface NativeTypeScriptModules {
  sync: typeof import('typescript-native/sync');
  ast: typeof import('typescript-native/ast');
  factory: typeof import('typescript-native/ast/factory');
}

export function createNativeSystem(): DocgenSystem {
  return {
    fileExists: (path) => {
      try {
        return statSync(path).isFile();
      } catch {
        return false;
      }
    },
    directoryExists: (path) => {
      try {
        return statSync(path).isDirectory();
      } catch {
        return false;
      }
    },
    readFile: (path) => {
      try {
        return readFileSync(path, 'utf-8');
      } catch {
        return undefined;
      }
    },
    useCaseSensitiveFileNames: isCaseSensitiveFileSystem(),
  };
}

const isCaseSensitiveFileSystem = () => !existsSync(withSwappedCase(process.execPath));

const withSwappedCase = (path: string) =>
  path.replace(/\w/g, (character) => {
    const upper = character.toUpperCase();
    return character === upper ? character.toLowerCase() : upper;
  });

export type NativeRequest<Result> = Generator<unknown, Result, unknown>;

export interface NativeDocgenTypeScript extends DocgenTypeScript {
  releaseSourceFiles(): void;
  batch<A, B = never>(first: NativeRequest<A>[], second?: NativeRequest<B>[]): [A[], B[]];
}

export function createNativeDocgenTypeScript(
  { sync, ast, factory }: NativeTypeScriptModules,
  api: API
): NativeDocgenTypeScript {
  let leases: RetainedSourceFile[] = [];
  const asNode = (node: ts.Node) => node as unknown as Node;
  const composed = composedGuards(ast);

  const guards = Object.fromEntries(
    DOCGEN_NODE_GUARDS.map((name) => {
      const guard =
        composed[name] ??
        ((ast as Record<string, unknown>)[NATIVE_GUARD_NAMES[name] ?? name] as
          | ((node: Node) => boolean)
          | undefined);
      if (typeof guard !== 'function') {
        throw new Error(`typescript/ast has no node guard for ${name}`);
      }
      return [name, (node: ts.Node) => guard(asNode(node))];
    })
  ) as unknown as DocgenNodeGuards;

  return {
    ...guards,
    ...nativeNodeAccessors(ast),
    JsxEmit: sync.JsxEmit as unknown as DocgenTypeScript['JsxEmit'],
    ModuleKind: sync.ModuleKind as unknown as DocgenTypeScript['ModuleKind'],
    ModuleResolutionKind:
      sync.ModuleResolutionKind as unknown as DocgenTypeScript['ModuleResolutionKind'],
    ObjectFlags: sync.ObjectFlags as unknown as DocgenTypeScript['ObjectFlags'],
    ScriptTarget: ast.ScriptTarget as unknown as DocgenTypeScript['ScriptTarget'],
    SymbolFlags: sync.SymbolFlags as unknown as DocgenTypeScript['SymbolFlags'],
    SyntaxKind: ast.SyntaxKind as unknown as DocgenTypeScript['SyntaxKind'],
    TypeFlags: sync.TypeFlags as unknown as DocgenTypeScript['TypeFlags'],
    TypeFormatFlags: sync.TypeFormatFlags as unknown as DocgenTypeScript['TypeFormatFlags'],
    factory: {
      createLiteralTypeNode: (literal) =>
        factory.createLiteralTypeNode(asNode(literal)) as unknown as ts.LiteralTypeNode,
      createStringLiteral: (text) =>
        factory.createStringLiteral(text, ast.TokenFlags.None) as unknown as ts.StringLiteral,
    },
    sys: createNativeSystem(),
    canHaveDecorators: (node): node is ts.HasDecorators => 'modifiers' in node,
    canHaveModifiers: (node): node is ts.HasModifiers => 'modifiers' in node,
    getDecorators: (node) =>
      (node as { modifiers?: readonly ts.ModifierLike[] }).modifiers?.filter((modifier) =>
        ast.isDecorator(asNode(modifier))
      ) as readonly ts.Decorator[] | undefined,
    getJSDocCommentsAndTags: (node) =>
      ast.getJSDocCommentsAndTags(asNode(node)) as unknown as (ts.JSDoc | ts.JSDocTag)[],
    getJSDocTags: (node) => ast.getJSDocTags(asNode(node)) as unknown as readonly ts.JSDocTag[],
    getLineAndCharacterOfPosition: (sourceFile, position) =>
      (
        sourceFile as unknown as Pick<ts.SourceFile, 'getLineAndCharacterOfPosition'>
      ).getLineAndCharacterOfPosition(position),
    printNode: (node, visit) => {
      const visitChildren = (child: ts.Node): ts.Node =>
        ast.visitEachChild(asNode(child), (grandchild) =>
          asNode(visit(grandchild as unknown as ts.Node, visitChildren))
        ) as unknown as ts.Node;
      return api.printer.printNode(asNode(visit(node, visitChildren)));
    },
    getModifiers: (node) =>
      (node as { modifiers?: readonly ts.ModifierLike[] }).modifiers?.filter((modifier) =>
        ast.isModifier(asNode(modifier))
      ) as readonly ts.Modifier[] | undefined,
    createSourceFile: (fileName, text) => {
      const lease = api.createSourceFile(fileName, text);
      leases.push(lease);
      return lease.sourceFile as unknown as ts.SourceFile;
    },
    releaseSourceFiles: () => {
      for (const lease of leases) {
        lease.dispose();
      }
      leases = [];
    },
    batch: <A, B>(first: NativeRequest<A>[], second: NativeRequest<B>[] = []) => {
      if (first.length === 0 && second.length === 0) {
        return [[], []] as [A[], B[]];
      }
      const [a, b] = api.batch(
        sync.all(...(first as Parameters<typeof sync.all>)),
        sync.all(...(second as Parameters<typeof sync.all>))
      );
      return [a as A[], b as B[]];
    },
    displayPartsToString: (parts) => (parts ?? []).map((part) => part.text).join(''),
    forEachChild: ((node: ts.Node, visitor: unknown, visitArray: unknown) =>
      asNode(node).forEachChild(
        visitor as (node: Node) => unknown,
        visitArray as ((nodes: unknown) => unknown) | undefined
      )) as DocgenTypeScript['forEachChild'],
    getEmptyObjectType: (checker) => NativeFacades.of(checker).getEmptyObjectType(),
  };
}
