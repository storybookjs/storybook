// The native API's checker behind the compiler API's method names, on a set of facades.
import type ts from 'typescript';
import type { Node } from 'typescript-native/ast';
import type { InterfaceType, Type as NativeType, TypeReference } from 'typescript-native/sync';

import type { DocgenTypeChecker } from '../docgen-typescript.ts';
import { CallCache } from './call-cache.ts';
import type { EmptyObjectTypeFacade, SymbolFacade, TypeFacade } from './facades.ts';
import type { NativeFacades } from './native-facades.ts';

// Every checker method docgen calls whose answer depends on its arguments and the snapshot alone,
// and that no facade map keeps. `typeToString` with its default options is in `NativeFacades`.
const CACHED_QUERIES = [
  'getAliasedSymbol',
  'getBaseTypeOfLiteralType',
  'getBaseTypes',
  'getDeclaredTypeOfSymbol',
  'getExportsOfModule',
  'getMergedSymbol',
  'getPropertyOfType',
  'getResolvedSignature',
  'getShorthandAssignmentValueSymbol',
  'getSignatureFromDeclaration',
  'getSymbolAtLocation',
  'getTypeArguments',
  'getTypeAtLocation',
  'getTypeOfSymbol',
  'resolveName',
] as const satisfies readonly (keyof DocgenTypeChecker)[];

export function createDocgenChecker(facades: NativeFacades): DocgenTypeChecker {
  const { checker } = facades;
  const calls = new CallCache();
  const unwrapSymbol = (symbol: ts.Symbol) => (symbol as unknown as SymbolFacade).native;
  // The empty object type has no native type. Only the methods that can get it handle that.
  const unwrapType = (type: ts.Type): NativeType | undefined =>
    (type as unknown as TypeFacade | EmptyObjectTypeFacade).native;
  const unwrapNativeType = (type: ts.Type): NativeType => {
    const native = unwrapType(type);
    if (!native) {
      throw new Error('The checker cannot take the empty object type here');
    }
    return native;
  };
  const asNode = (node: ts.Node) => node as unknown as Node;

  const docgenChecker: DocgenTypeChecker = {
    getAliasedSymbol: (symbol) => facades.symbol(checker.getAliasedSymbol(unwrapSymbol(symbol))),
    getBaseTypeOfLiteralType: (type) =>
      facades.type(checker.getBaseTypeOfLiteralType(unwrapNativeType(type))),
    getBaseTypes: (type) =>
      checker
        .getBaseTypes(unwrapNativeType(type) as InterfaceType)
        .map((base) => facades.type(base) as ts.BaseType),
    getDeclaredTypeOfSymbol: (symbol) =>
      facades.type(checker.getDeclaredTypeOfSymbol(unwrapSymbol(symbol))),
    getExportsOfModule: (symbol) =>
      checker.getExportsOfModule(unwrapSymbol(symbol)).map((exported) => facades.symbol(exported)),
    getMergedSymbol: (symbol) => facades.symbol(checker.getMergedSymbol(unwrapSymbol(symbol))),
    getPropertyOfType: (type, name) => {
      const native = unwrapType(type);
      return native && facades.symbol(checker.getPropertyOfType(native, name));
    },
    getResolvedSignature: (node) => facades.signature(checker.getResolvedSignature(asNode(node))),
    getShorthandAssignmentValueSymbol: (node) =>
      node ? facades.symbol(checker.getShorthandAssignmentValueSymbol(asNode(node))) : undefined,
    getSignatureFromDeclaration: (node) => {
      const signature = checker.getSignatureFromDeclaration(asNode(node));
      return signature && facades.signature(signature);
    },
    getSymbolAtLocation: (node) => facades.symbol(checker.getSymbolAtLocation(asNode(node))),
    getTypeArguments: (type) =>
      checker
        .getTypeArguments(unwrapNativeType(type) as TypeReference)
        .map((argument) => facades.type(argument)),
    getTypeAtLocation: (node) => facades.type(checker.getTypeAtLocation(asNode(node))),
    getTypeOfSymbol: (symbol) => facades.type(checker.getTypeOfSymbol(unwrapSymbol(symbol))),
    getTypeOfSymbolAtLocation: (symbol, node) =>
      facades.type(facades.typeOfSymbolAtLocation(unwrapSymbol(symbol), asNode(node))),
    getVoidType: () => facades.type(checker.getVoidType()),
    // The native API takes `meaning` before `location`.
    resolveName: (name, location, meaning, excludeGlobals) =>
      facades.symbol(
        checker.resolveName(name, meaning as number, location && asNode(location), excludeGlobals)
      ),
    typeToString: (type, enclosingDeclaration, flags) => {
      const native = unwrapType(type);
      if (!native) {
        return '{}';
      }
      if (enclosingDeclaration === undefined && flags === undefined) {
        return facades.typeToString(native);
      }
      return calls.answer('typeToString', [native, enclosingDeclaration, flags], () =>
        checker.typeToString(
          native,
          enclosingDeclaration && asNode(enclosingDeclaration),
          flags as number
        )
      );
    },
  };
  for (const method of CACHED_QUERIES) {
    const ask = docgenChecker[method] as (...args: unknown[]) => unknown;
    (docgenChecker as Record<string, unknown>)[method] = (...args: unknown[]) =>
      calls.answer(method, args, () => ask(...args));
  }
  return docgenChecker;
}
