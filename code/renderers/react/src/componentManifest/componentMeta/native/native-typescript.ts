/**
 * The extractor's TypeScript contract fulfilled by the native API of TypeScript 7.1 and newer:
 * `typescript/sync` (the client of the compiler process) and `typescript/ast` (node guards and
 * enums, which run in-process on the remote nodes).
 */
import { existsSync, readFileSync, statSync } from 'node:fs';

import type ts from 'typescript';
import type { Node } from 'typescript-native/ast';
import type { API, RetainedSourceFile } from 'typescript-native/sync';

import {
  DOCGEN_NODE_GUARDS,
  type DocgenNodeGuards,
  type DocgenSystem,
  type DocgenTypeScript,
} from '../docgen-typescript.ts';
import { NativeFacades } from './native-checker.ts';

/** The guards whose name differs between the compiler API and `typescript/ast`. */
const NATIVE_GUARD_NAMES: Partial<
  Record<(typeof DOCGEN_NODE_GUARDS)[number], keyof typeof import('typescript-native/ast')>
> = {
  isPropertySignature: 'isPropertySignatureDeclaration',
  isTypeAssertionExpression: 'isTypeAssertion',
};

/** The native API's modules, imported by the caller where its `typescript` peer resolves. */
export interface NativeTypeScriptModules {
  sync: typeof import('typescript-native/sync');
  ast: typeof import('typescript-native/ast');
}

/** The compiler API's `ts.sys` members, on the host filesystem. */
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
    // The compiler API's probe: a path with swapped case exists only on a case-insensitive filesystem.
    useCaseSensitiveFileNames: !existsSync(swapCase(process.execPath)),
  };
}

const swapCase = (path: string) =>
  path.replace(/\w/g, (character) => {
    const upper = character.toUpperCase();
    return character === upper ? character.toLowerCase() : upper;
  });

/** A request the native API can answer in a batch: the `gen` form of one of its methods. */
export type NativeRequest<Result> = Generator<unknown, Result, unknown>;

export interface NativeDocgenTypeScript extends DocgenTypeScript {
  /** Release the source files parsed outside a program since the last call. */
  releaseSourceFiles(): void;
  /** Send up to two groups of independent requests in one round trip to the compiler process. */
  batch<A, B = never>(first: NativeRequest<A>[], second?: NativeRequest<B>[]): [A[], B[]];
}

/**
 * Build the contract over the native modules. The checker passed to the members is one that
 * `NativeFacades.createChecker` returned, so `getEmptyObjectType` reads the facades from it.
 */
export function createNativeDocgenTypeScript(
  { sync, ast }: NativeTypeScriptModules,
  api: API
): NativeDocgenTypeScript {
  let leases: RetainedSourceFile[] = [];
  const asNode = (node: ts.Node) => node as unknown as Node;

  const guards = Object.fromEntries(
    DOCGEN_NODE_GUARDS.map((name) => {
      const guard = (ast as Record<string, unknown>)[NATIVE_GUARD_NAMES[name] ?? name] as
        | ((node: Node) => boolean)
        | undefined;
      if (typeof guard !== 'function') {
        throw new Error(`typescript/ast has no node guard for ${name}`);
      }
      return [name, (node: ts.Node) => guard(asNode(node))];
    })
  ) as unknown as DocgenNodeGuards;

  return {
    ...guards,
    JsxEmit: sync.JsxEmit as unknown as DocgenTypeScript['JsxEmit'],
    ModuleKind: sync.ModuleKind as unknown as DocgenTypeScript['ModuleKind'],
    ModuleResolutionKind:
      sync.ModuleResolutionKind as unknown as DocgenTypeScript['ModuleResolutionKind'],
    ScriptTarget: ast.ScriptTarget as unknown as DocgenTypeScript['ScriptTarget'],
    SymbolFlags: sync.SymbolFlags as unknown as DocgenTypeScript['SymbolFlags'],
    SyntaxKind: ast.SyntaxKind as unknown as DocgenTypeScript['SyntaxKind'],
    TypeFlags: sync.TypeFlags as unknown as DocgenTypeScript['TypeFlags'],
    sys: createNativeSystem(),
    canHaveModifiers: (node): node is ts.HasModifiers => 'modifiers' in node,
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
