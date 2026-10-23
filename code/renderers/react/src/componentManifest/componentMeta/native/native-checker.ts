/**
 * The native API's checker, symbols, types and signatures behind the compiler API's member names.
 *
 * `typescript/sync` returns one object per symbol, type and signature id within a project, and the
 * facades are memoized on those objects, so the extractor's identity comparisons (`symbol ===
 * other`) keep working. AST nodes are not wrapped: the native API's remote nodes already have the
 * compiler API's shape (`kind`, `parent`, `getText()`, `forEachChild`, the child properties).
 *
 * One facade set belongs to one snapshot's project. Objects from different snapshots must not be
 * mixed, so the project creates a new set whenever its snapshot changes.
 */
import type ts from 'typescript';
import type { Node } from 'typescript-native/ast';
import type {
  Checker,
  LiteralType,
  Project,
  Signature as NativeSignature,
  Symbol as NativeSymbol,
  Type as NativeType,
  TypeParameter,
  UnionOrIntersectionType,
} from 'typescript-native/sync';

import type { DocgenTypeChecker } from '../docgen-typescript.ts';

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
    const text = this.native.getDocumentationComment(this.facades.checker);
    return text ? [textPart(text)] : [];
  }

  getJsDocTags(): ts.JSDocTagInfo[] {
    return this.native.getJsDocTags(this.facades.checker).map(({ name, text }) => ({
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
    if (!this.native.isUnionType() && !this.native.isIntersectionType()) {
      return [];
    }
    return (this.native as UnionOrIntersectionType)
      .getTypes()
      .map((type) => this.facades.type(type));
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
    return this.native.getProperties().map((symbol) => this.facades.symbol(symbol)!);
  }

  getApparentProperties(): ts.Symbol[] {
    return this.native.getApparentProperties().map((symbol) => this.facades.symbol(symbol)!);
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
    return this.native.getParameters().map((symbol) => this.facades.symbol(symbol)!);
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

/** Memoized facades over one project's native objects. */
export class NativeFacades {
  private readonly symbols = new WeakMap<NativeSymbol, SymbolFacade>();
  private readonly types = new WeakMap<NativeType, TypeFacade>();
  private readonly signatures = new WeakMap<NativeSignature, SignatureFacade>();
  private readonly emptyObjectType = new EmptyObjectTypeFacade();

  constructor(
    readonly checker: Checker,
    readonly project: Project
  ) {}

  symbol(native: NativeSymbol): ts.Symbol;
  symbol(native: NativeSymbol | undefined): ts.Symbol | undefined;
  symbol(native: NativeSymbol | undefined): ts.Symbol | undefined {
    if (!native) {
      return undefined;
    }
    let facade = this.symbols.get(native);
    if (!facade) {
      facade = new SymbolFacade(native, this);
      this.symbols.set(native, facade);
    }
    return facade as unknown as ts.Symbol;
  }

  type(native: NativeType): ts.Type;
  type(native: NativeType | undefined): ts.Type | undefined;
  type(native: NativeType | undefined): ts.Type | undefined {
    if (!native) {
      return undefined;
    }
    let facade = this.types.get(native);
    if (!facade) {
      facade = new TypeFacade(native, this);
      this.types.set(native, facade);
    }
    return facade as unknown as ts.Type;
  }

  signature(native: NativeSignature): ts.Signature {
    let facade = this.signatures.get(native);
    if (!facade) {
      facade = new SignatureFacade(native, this);
      this.signatures.set(native, facade);
    }
    return facade as unknown as ts.Signature;
  }

  getEmptyObjectType(): ts.Type {
    return this.emptyObjectType as unknown as ts.Type;
  }

  /** The facades a checker from {@link createChecker} was built on. */
  static of(checker: DocgenTypeChecker): NativeFacades {
    const facades = (checker as { [NATIVE_FACADES]?: NativeFacades })[NATIVE_FACADES];
    if (!facades) {
      throw new Error('The checker was not created by NativeFacades.createChecker');
    }
    return facades;
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
        this.type(checker.getTypeOfSymbolAtLocation(unwrapSymbol(symbol), asNode(node))),
      getVoidType: () => this.type(checker.getVoidType()),
      typeToString: (type, enclosingDeclaration, flags) =>
        unwrapType(type)
          ? checker.typeToString(
              unwrapType(type),
              enclosingDeclaration && asNode(enclosingDeclaration),
              flags as number
            )
          : '{}',
    };
    Object.defineProperty(docgenChecker, NATIVE_FACADES, { value: this });
    return docgenChecker;
  }
}
