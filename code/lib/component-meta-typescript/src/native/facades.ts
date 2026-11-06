import type ts from 'typescript';
import type {
  LiteralType,
  ObjectType,
  Signature as NativeSignature,
  Symbol as NativeSymbol,
  Type as NativeType,
  TypeParameter,
} from 'typescript-native/sync';

import type { NativeFacades } from './native-facades.ts';

const textPart = (text: string): ts.SymbolDisplayPart => ({
  kind: 'text',
  text,
});

export class SymbolFacade {
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

export class TypeFacade {
  private properties?: ts.Symbol[];
  private apparentProperties?: ts.Symbol[];
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

  get value(): string | number | ts.PseudoBigInt {
    return (this.native as LiteralType).value as string | number;
  }

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
    return this.facades
      .callSignatures(this.native)
      .map((signature) => this.facades.signature(signature));
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

export class SignatureFacade {
  private resolvedParameters?: ts.Symbol[];

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
    return this.facades.type(this.facades.returnType(this.native));
  }
}

// The native API cannot type a synthesized node.
export class EmptyObjectTypeFacade {
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
