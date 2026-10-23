/**
 * The native API's checker, symbols, types and signatures behind the compiler API's member names.
 *
 * `typescript/sync` returns one object per symbol, type and signature id within a project, and the
 * facades are memoized on those objects, so the extractor's identity comparisons (`symbol ===
 * other`) keep working. AST nodes are not wrapped: the native API's remote nodes already have the
 * compiler API's shape (`kind`, `parent`, `getText()`, `forEachChild`, the child properties).
 *
 * Every checker call is a round trip to the compiler process, and the extractor asks the same
 * questions of every prop of a type in turn. So when a type lists its properties, the facades fetch
 * the doc comments and tags of all of them in one batch, and the first `getTypeOfSymbolAtLocation`
 * for one of them fetches the types, their text and their union members for the whole group. The
 * answers are cached for the life of the facade set.
 *
 * One facade set belongs to one snapshot's project. Objects from different snapshots must not be
 * mixed, so the project creates a new set whenever its snapshot changes.
 */
import type ts from 'typescript';
import type { Node } from 'typescript-native/ast';
import type {
  Checker,
  JSDocTagInfo,
  LiteralType,
  Project,
  Signature as NativeSignature,
  Symbol as NativeSymbol,
  Type as NativeType,
  TypeParameter,
  UnionOrIntersectionType,
} from 'typescript-native/sync';

import type { DocgenTypeChecker } from '../docgen-typescript.ts';
import type { NativeDocgenTypeScript } from './native-typescript.ts';

const textPart = (text: string): ts.SymbolDisplayPart => ({ kind: 'text', text });

const NATIVE_FACADES = Symbol('nativeFacades');

/** The members the extractor reads on a `ts.Symbol`. */
class SymbolFacade {
  private resolvedValueDeclaration?: ts.Declaration | null;
  private resolvedDeclarations?: ts.Declaration[];

  constructor(
    readonly native: NativeSymbol,
    private readonly facades: NativeFacades
  ) {}

  get name(): string {
    return this.native.name;
  }

  get escapedName(): ts.__String {
    return this.native.escapedName as unknown as ts.__String;
  }

  get flags(): ts.SymbolFlags {
    return this.native.flags as number;
  }

  getFlags(): ts.SymbolFlags {
    return this.flags;
  }

  getName(): string {
    return this.native.name;
  }

  get valueDeclaration(): ts.Declaration | undefined {
    if (this.resolvedValueDeclaration === undefined) {
      this.resolvedValueDeclaration =
        (this.native.valueDeclaration?.resolve() as ts.Declaration | undefined) ?? null;
    }
    return this.resolvedValueDeclaration ?? undefined;
  }

  get declarations(): ts.Declaration[] | undefined {
    return this.getDeclarations();
  }

  getDeclarations(): ts.Declaration[] | undefined {
    this.resolvedDeclarations ??= this.native.declarations.flatMap((handle) => {
      const node = handle.resolve() as ts.Declaration | undefined;
      return node ? [node] : [];
    });
    return this.resolvedDeclarations;
  }

  getDocumentationComment(): ts.SymbolDisplayPart[] {
    const text = this.facades.documentationComment(this.native);
    return text ? [textPart(text)] : [];
  }

  getJsDocTags(): ts.JSDocTagInfo[] {
    return this.facades.jsDocTags(this.native).map(({ name, text }) => ({
      name,
      text: text === undefined ? undefined : [textPart(text)],
    }));
  }
}

/** The members the extractor reads on a `ts.Type`. */
class TypeFacade {
  constructor(
    readonly native: NativeType,
    private readonly facades: NativeFacades
  ) {}

  get flags(): ts.TypeFlags {
    return this.native.flags as number;
  }

  getFlags(): ts.TypeFlags {
    return this.flags;
  }

  get symbol(): ts.Symbol {
    return this.getSymbol() as ts.Symbol;
  }

  getSymbol(): ts.Symbol | undefined {
    return this.facades.symbol(this.native.getSymbol());
  }

  /** The literal value of a literal type. */
  get value(): string | number | ts.PseudoBigInt {
    return (this.native as LiteralType).value as string | number;
  }

  /** The members of a union or intersection type. */
  get types(): ts.Type[] {
    return this.facades.memberTypes(this.native).map((type) => this.facades.type(type));
  }

  isUnion(): boolean {
    return this.native.isUnionType();
  }

  isIntersection(): boolean {
    return this.native.isIntersectionType();
  }

  isStringLiteral(): boolean {
    return this.native.isStringLiteralType();
  }

  isNumberLiteral(): boolean {
    return this.native.isNumberLiteralType();
  }

  getProperty(name: string): ts.Symbol | undefined {
    return this.facades.symbol(this.native.getProperty(name));
  }

  getProperties(): ts.Symbol[] {
    return this.facades.symbols(this.native.getProperties());
  }

  getApparentProperties(): ts.Symbol[] {
    return this.facades.symbols(this.native.getApparentProperties());
  }

  getCallSignatures(): ts.Signature[] {
    return this.native.getCallSignatures().map((signature) => this.facades.signature(signature));
  }

  getConstructSignatures(): ts.Signature[] {
    return this.native
      .getConstructSignatures()
      .map((signature) => this.facades.signature(signature));
  }

  getConstraint(): ts.Type | undefined {
    return this.native.isTypeParameter()
      ? this.facades.type((this.native as TypeParameter).getConstraint())
      : undefined;
  }
}

/** The members the extractor reads on a `ts.Signature`. */
class SignatureFacade {
  constructor(
    readonly native: NativeSignature,
    private readonly facades: NativeFacades
  ) {}

  get parameters(): ts.Symbol[] {
    return this.getParameters();
  }

  getParameters(): ts.Symbol[] {
    return this.native.getParameters().map((symbol) => this.facades.symbol(symbol));
  }

  getReturnType(): ts.Type {
    return this.facades.type(this.native.getReturnType());
  }
}

/**
 * The type of `{}` for a component whose signature takes no props. The native API cannot type a
 * synthesized node, and the extractor only reads this type's (absent) members.
 */
class EmptyObjectTypeFacade {
  readonly native = undefined;
  readonly flags = 0;
  getFlags = () => 0;
  getSymbol = () => undefined;
  readonly types: ts.Type[] = [];
  isUnion = () => false;
  isIntersection = () => false;
  isStringLiteral = () => false;
  isNumberLiteral = () => false;
  getProperty = () => undefined;
  getProperties = (): ts.Symbol[] => [];
  getApparentProperties = (): ts.Symbol[] => [];
  getCallSignatures = (): ts.Signature[] => [];
  getConstructSignatures = (): ts.Signature[] => [];
  getConstraint = () => undefined;
}

/** Memoized facades over one project's native objects, with the batched prefetches. */
export class NativeFacades {
  readonly checker: Checker;
  private readonly symbolFacades = new WeakMap<NativeSymbol, SymbolFacade>();
  private readonly typeFacades = new WeakMap<NativeType, TypeFacade>();
  private readonly signatureFacades = new WeakMap<NativeSignature, SignatureFacade>();
  private readonly emptyObjectType = new EmptyObjectTypeFacade();

  /** The properties a symbol was listed with, so one lookup can prefetch for all of them. */
  private readonly groupOf = new WeakMap<NativeSymbol, readonly NativeSymbol[]>();
  private readonly tags = new WeakMap<NativeSymbol, readonly JSDocTagInfo[]>();
  private readonly docs = new WeakMap<NativeSymbol, string>();
  private readonly typeAtLocation = new WeakMap<Node, Map<NativeSymbol, NativeType>>();
  private readonly typeText = new WeakMap<NativeType, string>();
  private readonly members = new WeakMap<NativeType, readonly NativeType[]>();

  constructor(
    readonly project: Project,
    private readonly typescript: NativeDocgenTypeScript
  ) {
    this.checker = project.checker;
  }

  /** The facades a checker from {@link createChecker} was built on. */
  static of(checker: DocgenTypeChecker): NativeFacades {
    const facades = (checker as { [NATIVE_FACADES]?: NativeFacades })[NATIVE_FACADES];
    if (!facades) {
      throw new Error('The checker was not created by NativeFacades.createChecker');
    }
    return facades;
  }

  symbol(native: NativeSymbol): ts.Symbol;
  symbol(native: NativeSymbol | undefined): ts.Symbol | undefined;
  symbol(native: NativeSymbol | undefined): ts.Symbol | undefined {
    if (!native) {
      return undefined;
    }
    let facade = this.symbolFacades.get(native);
    if (!facade) {
      facade = new SymbolFacade(native, this);
      this.symbolFacades.set(native, facade);
    }
    return facade as unknown as ts.Symbol;
  }

  /** The facades of a type's properties, with their docs and tags fetched in one batch. */
  symbols(natives: readonly NativeSymbol[]): ts.Symbol[] {
    this.prefetchDocs(natives);
    return natives.map((native) => this.symbol(native));
  }

  type(native: NativeType): ts.Type;
  type(native: NativeType | undefined): ts.Type | undefined;
  type(native: NativeType | undefined): ts.Type | undefined {
    if (!native) {
      return undefined;
    }
    let facade = this.typeFacades.get(native);
    if (!facade) {
      facade = new TypeFacade(native, this);
      this.typeFacades.set(native, facade);
    }
    return facade as unknown as ts.Type;
  }

  signature(native: NativeSignature): ts.Signature {
    let facade = this.signatureFacades.get(native);
    if (!facade) {
      facade = new SignatureFacade(native, this);
      this.signatureFacades.set(native, facade);
    }
    return facade as unknown as ts.Signature;
  }

  getEmptyObjectType(): ts.Type {
    return this.emptyObjectType as unknown as ts.Type;
  }

  jsDocTags(symbol: NativeSymbol): readonly JSDocTagInfo[] {
    let tags = this.tags.get(symbol);
    if (!tags) {
      tags = this.checker.getJsDocTagsOfSymbol(symbol);
      this.tags.set(symbol, tags);
    }
    return tags;
  }

  documentationComment(symbol: NativeSymbol): string {
    let doc = this.docs.get(symbol);
    if (doc === undefined) {
      doc = this.checker.getDocumentationCommentOfSymbol(symbol);
      this.docs.set(symbol, doc);
    }
    return doc;
  }

  memberTypes(type: NativeType): readonly NativeType[] {
    let members = this.members.get(type);
    if (!members) {
      members =
        type.isUnionType() || type.isIntersectionType()
          ? (type as UnionOrIntersectionType).getTypes()
          : [];
      this.members.set(type, members);
    }
    return members;
  }

  typeToString(type: NativeType): string {
    let text = this.typeText.get(type);
    if (text === undefined) {
      text = this.checker.typeToString(type);
      this.typeText.set(type, text);
    }
    return text;
  }

  typeOfSymbolAtLocation(symbol: NativeSymbol, location: Node): NativeType {
    let byLocation = this.typeAtLocation.get(location);
    if (!byLocation) {
      byLocation = new Map();
      this.typeAtLocation.set(location, byLocation);
    }
    const cached = byLocation.get(symbol);
    if (cached) {
      return cached;
    }
    const group = this.groupOf.get(symbol)?.filter((member) => !byLocation.has(member)) ?? [];
    if (group.length > 1) {
      this.prefetchTypes(group, location, byLocation);
      const type = byLocation.get(symbol);
      if (type) {
        return type;
      }
    }
    const type = this.checker.getTypeOfSymbolAtLocation(symbol, location);
    byLocation.set(symbol, type);
    return type;
  }

  /** One round trip for the doc comments and tags of a type's properties. */
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

  /**
   * One round trip for the types of a property group at a location, then one for their text and
   * the members of the unions among them, which the extractor reads next.
   */
  private prefetchTypes(
    symbols: readonly NativeSymbol[],
    location: Node,
    byLocation: Map<NativeSymbol, NativeType>
  ): void {
    const { checker } = this;
    const [types] = this.typescript.batch(
      symbols.map((symbol) => checker.getTypeOfSymbolAtLocation.gen(symbol, location))
    );
    symbols.forEach((symbol, index) => byLocation.set(symbol, types[index]));

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

  /** The checker with the compiler API's method names and the facades' objects. */
  createChecker(): DocgenTypeChecker {
    const { checker } = this;
    const unwrapSymbol = (symbol: ts.Symbol) => (symbol as unknown as SymbolFacade).native;
    const unwrapType = (type: ts.Type) => (type as unknown as TypeFacade).native;
    const asNode = (node: ts.Node) => node as unknown as Node;

    const docgenChecker: DocgenTypeChecker = {
      getAliasedSymbol: (symbol) => this.symbol(checker.getAliasedSymbol(unwrapSymbol(symbol))),
      getExportsOfModule: (symbol) =>
        checker.getExportsOfModule(unwrapSymbol(symbol)).map((exported) => this.symbol(exported)),
      getMergedSymbol: (symbol) => this.symbol(checker.getMergedSymbol(unwrapSymbol(symbol))),
      getPropertyOfType: (type, name) =>
        unwrapType(type)
          ? this.symbol(checker.getPropertyOfType(unwrapType(type), name))
          : undefined,
      getResolvedSignature: (node) => this.signature(checker.getResolvedSignature(asNode(node))),
      getShorthandAssignmentValueSymbol: (node) =>
        node ? this.symbol(checker.getShorthandAssignmentValueSymbol(asNode(node))) : undefined,
      getSymbolAtLocation: (node) => this.symbol(checker.getSymbolAtLocation(asNode(node))),
      getTypeAtLocation: (node) => this.type(checker.getTypeAtLocation(asNode(node))),
      getTypeOfSymbol: (symbol) => this.type(checker.getTypeOfSymbol(unwrapSymbol(symbol))),
      getTypeOfSymbolAtLocation: (symbol, node) =>
        this.type(this.typeOfSymbolAtLocation(unwrapSymbol(symbol), asNode(node))),
      getVoidType: () => this.type(checker.getVoidType()),
      typeToString: (type, enclosingDeclaration, flags) => {
        const native = unwrapType(type);
        if (!native) {
          return '{}';
        }
        return enclosingDeclaration === undefined && flags === undefined
          ? this.typeToString(native)
          : checker.typeToString(
              native,
              enclosingDeclaration && asNode(enclosingDeclaration),
              flags as number
            );
      },
    };
    Object.defineProperty(docgenChecker, NATIVE_FACADES, { value: this });
    return docgenChecker;
  }
}
