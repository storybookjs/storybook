// Memoized facades over one project's native objects. `typescript/sync` returns one object per id
// within a project and the facades are memoized on those objects, so docgen's `symbol === other`
// comparisons hold. Nodes are not wrapped: remote nodes already have the compiler API's shape.
//
// Every checker call is a round trip to the compiler process. A facade set lives as long as its
// snapshot and caches every answer; when a type lists its properties, one round trip fetches their
// docs, and the first type asked for fetches the whole group's.
import type ts from 'typescript';
import type { Node } from 'typescript-native/ast';
import type {
  Checker,
  JSDocTagInfo,
  Project,
  Signature as NativeSignature,
  Symbol as NativeSymbol,
  Type as NativeType,
  UnionOrIntersectionType,
} from 'typescript-native/sync';

import type { DocgenTypeChecker } from '../docgen-typescript.ts';
import { getOrCompute } from './call-cache.ts';
import { EmptyObjectTypeFacade, SignatureFacade, SymbolFacade, TypeFacade } from './facades.ts';
import { createDocgenChecker } from './native-checker.ts';
import type { NativeDocgenTypeScript } from './native-typescript.ts';

const NATIVE_FACADES = Symbol('nativeFacades');

export class NativeFacades {
  readonly checker: Checker;
  private readonly symbolFacades = new WeakMap<NativeSymbol, SymbolFacade>();
  private readonly typeFacades = new WeakMap<NativeType, TypeFacade>();
  private readonly signatureFacades = new WeakMap<NativeSignature, SignatureFacade>();
  private readonly emptyObjectType = new EmptyObjectTypeFacade();

  // The answers the prefetches fill, each kept here alone.
  // The properties a symbol was listed with, so one lookup can prefetch for all of them.
  private readonly groupOf = new WeakMap<NativeSymbol, readonly NativeSymbol[]>();
  private readonly tags = new WeakMap<NativeSymbol, readonly JSDocTagInfo[]>();
  private readonly docs = new WeakMap<NativeSymbol, string>();
  private readonly typeAtLocation = new WeakMap<Node, Map<NativeSymbol, NativeType>>();
  private readonly typeText = new WeakMap<NativeType, string>();
  private readonly members = new WeakMap<NativeType, readonly NativeType[]>();
  private readonly typesAtDeclarationFetched = new WeakSet<NativeSymbol>();
  private readonly callSignaturesOf = new WeakMap<NativeType, readonly NativeSignature[]>();
  private readonly returnTypeOf = new WeakMap<NativeSignature, NativeType>();
  private docgenChecker?: DocgenTypeChecker;

  constructor(
    readonly project: Project,
    private readonly typescript: NativeDocgenTypeScript
  ) {
    this.checker = project.checker;
  }

  // The facades a checker from `createChecker` was built on.
  static of(checker: DocgenTypeChecker): NativeFacades {
    const facades = (checker as { [NATIVE_FACADES]?: NativeFacades })[NATIVE_FACADES];
    if (!facades) {
      throw new Error('The checker was not created by NativeFacades.createChecker');
    }
    return facades;
  }

  // The checker with the compiler API's method names and the facades' objects.
  createChecker(): DocgenTypeChecker {
    if (!this.docgenChecker) {
      this.docgenChecker = createDocgenChecker(this);
      Object.defineProperty(this.docgenChecker, NATIVE_FACADES, { value: this });
    }
    return this.docgenChecker;
  }

  symbol(native: NativeSymbol): ts.Symbol;
  symbol(native: NativeSymbol | undefined): ts.Symbol | undefined;
  symbol(native: NativeSymbol | undefined): ts.Symbol | undefined {
    return native
      ? (getOrCompute(
          this.symbolFacades,
          native,
          () => new SymbolFacade(native, this)
        ) as unknown as ts.Symbol)
      : undefined;
  }

  // The facades of a type's properties, with their docs and tags fetched in one batch.
  symbols(natives: readonly NativeSymbol[]): ts.Symbol[] {
    this.prefetchDocs(natives);
    return natives.map((native) => this.symbol(native));
  }

  type(native: NativeType): ts.Type;
  type(native: NativeType | undefined): ts.Type | undefined;
  type(native: NativeType | undefined): ts.Type | undefined {
    return native
      ? (getOrCompute(
          this.typeFacades,
          native,
          () => new TypeFacade(native, this)
        ) as unknown as ts.Type)
      : undefined;
  }

  signature(native: NativeSignature): ts.Signature {
    return getOrCompute(
      this.signatureFacades,
      native,
      () => new SignatureFacade(native, this)
    ) as unknown as ts.Signature;
  }

  getEmptyObjectType(): ts.Type {
    return this.emptyObjectType as unknown as ts.Type;
  }

  jsDocTags(symbol: NativeSymbol): readonly JSDocTagInfo[] {
    return getOrCompute(this.tags, symbol, () => this.checker.getJsDocTagsOfSymbol(symbol));
  }

  documentationComment(symbol: NativeSymbol): string {
    return getOrCompute(this.docs, symbol, () =>
      this.checker.getDocumentationCommentOfSymbol(symbol)
    );
  }

  memberTypes(type: NativeType): readonly NativeType[] {
    return getOrCompute(this.members, type, () =>
      type.isUnionType() || type.isIntersectionType()
        ? (type as UnionOrIntersectionType).getTypes()
        : []
    );
  }

  typeToString(type: NativeType): string {
    return getOrCompute(this.typeText, type, () => this.checker.typeToString(type));
  }

  callSignatures(type: NativeType): readonly NativeSignature[] {
    return getOrCompute(this.callSignaturesOf, type, () => type.getCallSignatures());
  }

  returnType(signature: NativeSignature): NativeType {
    return getOrCompute(this.returnTypeOf, signature, () => signature.getReturnType());
  }

  typeOfSymbolAtLocation(symbol: NativeSymbol, location: Node): NativeType {
    const byLocation = this.typesAt(location);
    const cached = byLocation.get(symbol);
    if (cached) {
      return cached;
    }
    // At its own declaration, a symbol's type is asked for one member after another, each at its
    // own declaration; elsewhere, for every member at the one location.
    const group = this.groupOf.get(symbol);
    if (group && group.length > 1) {
      if (this.isDeclarationOf(symbol, location)) {
        this.prefetchTypesAtDeclarations(group);
      } else {
        this.prefetchTypes(
          group.filter((member) => !byLocation.has(member)),
          location,
          byLocation
        );
      }
    }
    return getOrCompute(byLocation, symbol, () =>
      this.checker.getTypeOfSymbolAtLocation(symbol, location)
    );
  }

  private typesAt(location: Node): Map<NativeSymbol, NativeType> {
    return getOrCompute(this.typeAtLocation, location, () => new Map());
  }

  private isDeclarationOf(symbol: NativeSymbol, location: Node): boolean {
    return !!(this.symbol(symbol) as unknown as SymbolFacade)
      .getDeclarations()
      ?.includes(location as unknown as ts.Declaration);
  }

  // One round trip for the doc comments and tags of a type's properties.
  private prefetchDocs(symbols: readonly NativeSymbol[]): void {
    const missing = symbols.filter((symbol) => !this.docs.has(symbol));
    for (const symbol of symbols) {
      this.groupOf.set(symbol, symbols);
    }
    if (missing.length < 2) {
      return;
    }
    const { checker } = this;
    const [docs, tags] = this.typescript.batch(
      missing.map((symbol) => checker.getDocumentationCommentOfSymbol.gen(symbol)),
      missing.map((symbol) => checker.getJsDocTagsOfSymbol.gen(symbol))
    );
    missing.forEach((symbol, index) => {
      this.docs.set(symbol, docs[index]);
      this.tags.set(symbol, tags[index]);
    });
  }

  // One round trip for the types of a property group at a location, then one for their text and
  // the members of the unions among them, which the extractor reads next.
  private prefetchTypes(
    symbols: readonly NativeSymbol[],
    location: Node,
    byLocation: Map<NativeSymbol, NativeType>
  ): void {
    if (symbols.length < 2) {
      return;
    }
    const { checker } = this;
    const [types] = this.typescript.batch(
      symbols.map((symbol) => checker.getTypeOfSymbolAtLocation.gen(symbol, location))
    );
    symbols.forEach((symbol, index) => byLocation.set(symbol, types[index]));
    this.prefetchTexts(types);
  }

  // One round trip for the types of a property group, each at its own first declaration.
  private prefetchTypesAtDeclarations(symbols: readonly NativeSymbol[]): void {
    const located = symbols.flatMap((symbol) => {
      if (this.typesAtDeclarationFetched.has(symbol)) {
        return [];
      }
      this.typesAtDeclarationFetched.add(symbol);
      const declaration = (this.symbol(symbol) as unknown as SymbolFacade).getDeclarations()?.[0];
      return declaration ? [{ symbol, location: declaration as unknown as Node }] : [];
    });
    if (located.length < 2) {
      return;
    }
    const { checker } = this;
    const [types] = this.typescript.batch(
      located.map(({ symbol, location }) => checker.getTypeOfSymbolAtLocation.gen(symbol, location))
    );
    located.forEach(({ symbol, location }, index) =>
      this.typesAt(location).set(symbol, types[index])
    );
    this.prefetchTexts(types);
    this.prefetchSignatures(types);
  }

  // Two round trips for the call signatures of the object types among `types` and their return
  // types, which docgen reads next for a method.
  private prefetchSignatures(types: readonly NativeType[]): void {
    const objects = [...new Set(types)].filter(
      (type) => type.flags & this.typescript.TypeFlags.Object && !this.callSignaturesOf.has(type)
    );
    if (objects.length < 2) {
      return;
    }
    const [signatureLists] = this.typescript.batch(
      objects.map((type) => type.getCallSignatures.gen())
    );
    objects.forEach((type, index) => this.callSignaturesOf.set(type, signatureLists[index]));
    const signatures = signatureLists
      .flat()
      .filter((signature) => !this.returnTypeOf.has(signature));
    const [returnTypes] = this.typescript.batch(
      signatures.map((signature) => signature.getReturnType.gen())
    );
    signatures.forEach((signature, index) => this.returnTypeOf.set(signature, returnTypes[index]));
  }

  // One round trip for the text of the types and the members of the unions among them.
  private prefetchTexts(types: readonly NativeType[]): void {
    const { checker } = this;
    const untexted = [...new Set(types)].filter((type) => !this.typeText.has(type));
    const unions = untexted.filter(
      (type) => (type.isUnionType() || type.isIntersectionType()) && !this.members.has(type)
    );
    const [texts, members] = this.typescript.batch(
      untexted.map((type) => checker.typeToString.gen(type)),
      unions.map((type) => (type as UnionOrIntersectionType).getTypes.gen())
    );
    untexted.forEach((type, index) => this.typeText.set(type, texts[index]));
    unions.forEach((type, index) => this.members.set(type, members[index] ?? []));
  }
}
