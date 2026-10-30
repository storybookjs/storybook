// The native API's checker, symbols, types and signatures behind the compiler API's member names.
// `typescript/sync` returns one object per id within a project and the facades are memoized on
// those objects, so docgen's `symbol === other` comparisons hold. Nodes are not wrapped: remote
// nodes already have the compiler API's shape.
//
// Every checker call is a round trip to the compiler process. A facade set lives as long as its
// snapshot and caches every answer; when a type lists its properties, one round trip fetches their
// docs, and the first type asked for fetches the whole group's.
import type ts from 'typescript';
import type { Node } from 'typescript-native/ast';
import type {
  Checker,
  InterfaceType,
  JSDocTagInfo,
  LiteralType,
  ObjectType,
  Project,
  Signature as NativeSignature,
  Symbol as NativeSymbol,
  Type as NativeType,
  TypeParameter,
  TypeReference,
  UnionOrIntersectionType,
} from 'typescript-native/sync';

import type { DocgenTypeChecker } from '../docgen-typescript.ts';
import type { NativeDocgenTypeScript } from './native-typescript.ts';

const textPart = (text: string): ts.SymbolDisplayPart => ({
  kind: 'text',
  text,
});

const NATIVE_FACADES = Symbol('nativeFacades');

// The members the extractor reads on a `ts.Symbol`.
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

// The members the extractor reads on a `ts.Type`.
class TypeFacade {
  // Each a round trip, asked again for every component that inherits the type.
  private properties?: ts.Symbol[];
  private apparentProperties?: ts.Symbol[];
  private callSignatures?: ts.Signature[];
  private constructSignatures?: ts.Signature[];

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

  get aliasSymbol(): ts.Symbol | undefined {
    return this.facades.symbol(this.native.getAliasSymbol());
  }

  get objectFlags(): ts.ObjectFlags {
    return (this.native as ObjectType).objectFlags as number;
  }

  getSymbol(): ts.Symbol | undefined {
    return this.facades.symbol(this.native.getSymbol());
  }

  // The literal value of a literal type.
  get value(): string | number | ts.PseudoBigInt {
    return (this.native as LiteralType).value as string | number;
  }

  // The members of a union or intersection type.
  get types(): ts.Type[] {
    return this.facades.memberTypes(this.native).map((type) => this.facades.type(type));
  }

  isUnion(): boolean {
    return this.native.isUnionType();
  }

  isClassOrInterface(): boolean {
    return this.native.isClassOrInterface();
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
    this.properties ??= this.facades.symbols(this.native.getProperties());
    return this.properties;
  }

  getApparentProperties(): ts.Symbol[] {
    this.apparentProperties ??= this.facades.symbols(this.native.getApparentProperties());
    return this.apparentProperties;
  }

  getCallSignatures(): ts.Signature[] {
    this.callSignatures ??= this.facades
      .callSignatures(this.native)
      .map((signature) => this.facades.signature(signature));
    return this.callSignatures;
  }

  getConstructSignatures(): ts.Signature[] {
    this.constructSignatures ??= this.native
      .getConstructSignatures()
      .map((signature) => this.facades.signature(signature));
    return this.constructSignatures;
  }

  getConstraint(): ts.Type | undefined {
    return this.native.isTypeParameter()
      ? this.facades.type((this.native as TypeParameter).getConstraint())
      : undefined;
  }
}

// The members the extractor reads on a `ts.Signature`.
class SignatureFacade {
  private resolvedParameters?: ts.Symbol[];
  private returnType?: ts.Type;

  constructor(
    readonly native: NativeSignature,
    private readonly facades: NativeFacades
  ) {}

  get parameters(): ts.Symbol[] {
    return this.getParameters();
  }

  get declaration(): ts.SignatureDeclaration | undefined {
    return this.native.declaration?.resolve() as ts.SignatureDeclaration | undefined;
  }

  getParameters(): ts.Symbol[] {
    this.resolvedParameters ??= this.native
      .getParameters()
      .map((symbol) => this.facades.symbol(symbol));
    return this.resolvedParameters;
  }

  getReturnType(): ts.Type {
    this.returnType ??= this.facades.type(this.facades.returnType(this.native));
    return this.returnType;
  }
}

// The type of `{}` for a component whose signature takes no props. The native API cannot type a
// synthesized node, and the extractor only reads this type's (absent) members.
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

interface CallLevel {
  objects?: WeakMap<object, CallLevel>;
  values?: Map<unknown, CallLevel>;
  answered?: boolean;
  answer?: unknown;
}

// The answers of pure checker queries, keyed by their arguments' identity. Every argument is a
// facade, a node or a primitive of one snapshot, so an answer holds for that snapshot's life.
class CallCache {
  private readonly methods = new Map<string, CallLevel>();

  answer<Answer>(method: string, args: readonly unknown[], ask: () => Answer): Answer {
    let level = this.methods.get(method);
    if (!level) {
      level = {};
      this.methods.set(method, level);
    }
    for (const arg of args) {
      level =
        arg !== null && typeof arg === 'object'
          ? this.objectLevel(level, arg)
          : this.valueLevel(level, arg);
    }
    if (!level.answered) {
      level.answer = ask();
      level.answered = true;
    }
    return level.answer as Answer;
  }

  private objectLevel(level: CallLevel, arg: object): CallLevel {
    level.objects ??= new WeakMap();
    let next = level.objects.get(arg);
    if (!next) {
      next = {};
      level.objects.set(arg, next);
    }
    return next;
  }

  private valueLevel(level: CallLevel, arg: unknown): CallLevel {
    level.values ??= new Map();
    let next = level.values.get(arg);
    if (!next) {
      next = {};
      level.values.set(arg, next);
    }
    return next;
  }
}

/** Memoized facades over one project's native objects, with the batched prefetches. */
export class NativeFacades {
  readonly checker: Checker;
  private readonly symbolFacades = new WeakMap<NativeSymbol, SymbolFacade>();
  private readonly typeFacades = new WeakMap<NativeType, TypeFacade>();
  private readonly signatureFacades = new WeakMap<NativeSignature, SignatureFacade>();
  private readonly emptyObjectType = new EmptyObjectTypeFacade();

  // The properties a symbol was listed with, so one lookup can prefetch for all of them.
  private readonly groupOf = new WeakMap<NativeSymbol, readonly NativeSymbol[]>();
  private readonly tags = new WeakMap<NativeSymbol, readonly JSDocTagInfo[]>();
  private readonly docs = new WeakMap<NativeSymbol, string>();
  private readonly typeAtLocation = new WeakMap<Node, Map<NativeSymbol, NativeType>>();
  private readonly typeText = new WeakMap<NativeType, string>();
  private readonly members = new WeakMap<NativeType, readonly NativeType[]>();
  private readonly calls = new CallCache();
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
      const type = byLocation.get(symbol);
      if (type) {
        return type;
      }
    }
    const type = this.checker.getTypeOfSymbolAtLocation(symbol, location);
    byLocation.set(symbol, type);
    return type;
  }

  private typesAt(location: Node): Map<NativeSymbol, NativeType> {
    let byLocation = this.typeAtLocation.get(location);
    if (!byLocation) {
      byLocation = new Map();
      this.typeAtLocation.set(location, byLocation);
    }
    return byLocation;
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

  callSignatures(type: NativeType): readonly NativeSignature[] {
    let signatures = this.callSignaturesOf.get(type);
    if (!signatures) {
      signatures = type.getCallSignatures();
      this.callSignaturesOf.set(type, signatures);
    }
    return signatures;
  }

  returnType(signature: NativeSignature): NativeType {
    let type = this.returnTypeOf.get(signature);
    if (!type) {
      type = signature.getReturnType();
      this.returnTypeOf.set(signature, type);
    }
    return type;
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

  /** The checker with the compiler API's method names and the facades' objects. */
  createChecker(): DocgenTypeChecker {
    this.docgenChecker ??= this.buildChecker();
    return this.docgenChecker;
  }

  private buildChecker(): DocgenTypeChecker {
    const { checker } = this;
    const unwrapSymbol = (symbol: ts.Symbol) => (symbol as unknown as SymbolFacade).native;
    const unwrapType = (type: ts.Type) => (type as unknown as TypeFacade).native;
    const asNode = (node: ts.Node) => node as unknown as Node;

    const docgenChecker: DocgenTypeChecker = {
      getAliasedSymbol: (symbol) => this.symbol(checker.getAliasedSymbol(unwrapSymbol(symbol))),
      getBaseTypeOfLiteralType: (type) =>
        this.type(checker.getBaseTypeOfLiteralType(unwrapType(type))),
      getBaseTypes: (type) =>
        checker
          .getBaseTypes(unwrapType(type) as InterfaceType)
          .map((base) => this.type(base) as ts.BaseType),
      getDeclaredTypeOfSymbol: (symbol) =>
        this.type(checker.getDeclaredTypeOfSymbol(unwrapSymbol(symbol))),
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
      getSignatureFromDeclaration: (node) => {
        const signature = checker.getSignatureFromDeclaration(asNode(node));
        return signature && this.signature(signature);
      },
      getSymbolAtLocation: (node) => this.symbol(checker.getSymbolAtLocation(asNode(node))),
      getTypeArguments: (type) =>
        checker
          .getTypeArguments(unwrapType(type) as TypeReference)
          .map((argument) => this.type(argument)),
      getTypeAtLocation: (node) => this.type(checker.getTypeAtLocation(asNode(node))),
      getTypeOfSymbol: (symbol) => this.type(checker.getTypeOfSymbol(unwrapSymbol(symbol))),
      getTypeOfSymbolAtLocation: (symbol, node) =>
        this.type(this.typeOfSymbolAtLocation(unwrapSymbol(symbol), asNode(node))),
      getVoidType: () => this.type(checker.getVoidType()),
      // The native API takes `meaning` before `location`.
      resolveName: (name, location, meaning, excludeGlobals) =>
        this.symbol(
          checker.resolveName(name, meaning as number, location && asNode(location), excludeGlobals)
        ),
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
    for (const method of CACHED_QUERIES) {
      const ask = docgenChecker[method] as (...args: unknown[]) => unknown;
      (docgenChecker as Record<string, unknown>)[method] = (...args: unknown[]) =>
        this.calls.answer(method, args, () => ask(...args));
    }
    Object.defineProperty(docgenChecker, NATIVE_FACADES, { value: this });
    return docgenChecker;
  }
}

// Every checker method docgen calls whose answer depends on its arguments and the snapshot alone.
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
  'typeToString',
] as const satisfies readonly (keyof DocgenTypeChecker)[];
