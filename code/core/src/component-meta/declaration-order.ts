interface DeclarationLike {
  parent?: unknown;
  pos: number;
}

export interface DeclaredSymbolLike {
  declarations?: readonly DeclarationLike[];
}

export interface UnionMemberLike {
  flags: number;
  value?: unknown;
  symbol?: DeclaredSymbolLike;
  isStringLiteral(): boolean;
  isNumberLiteral(): boolean;
}

export interface DeclarationOrderFlags {
  TypeFlags: { Null: number; Undefined: number };
}

export interface DeclarationOrderHost<TNode> extends DeclarationOrderFlags {
  SyntaxKind: { MinusToken: number; KeyOfKeyword: number };
  SymbolFlags: { Alias: number; Enum: number; EnumMember: number };
  isParenthesizedTypeNode(node: TNode): node is TNode & { type: TNode };
  isUnionTypeNode(node: TNode): node is TNode & { types: readonly TNode[] };
  isLiteralTypeNode(node: TNode): node is TNode & { literal: TNode };
  isStringLiteralLike(node: TNode): node is TNode & { text: string };
  isNumericLiteral(node: TNode): node is TNode & { text: string };
  isPrefixUnaryExpression(node: TNode): node is TNode & { operator: number; operand: TNode };
  isTypeReferenceNode(
    node: TNode
  ): node is TNode & { typeName: TNode; typeArguments?: readonly TNode[] };
  isTypeAliasDeclaration(node: TNode): node is TNode & { type: TNode };
  isIndexedAccessTypeNode(node: TNode): node is TNode & { objectType: TNode; indexType: TNode };
  isPropertySignature(node: TNode): node is TNode & { type?: TNode };
  isPropertyDeclaration(node: TNode): node is TNode & { type?: TNode };
  isTypeOperatorNode(node: TNode): node is TNode & { operator: number; type: TNode };
  isTemplateLiteralTypeNode(node: TNode): node is TNode & {
    head: { text: string };
    templateSpans: readonly { type: TNode; literal: { text: string } }[];
  };
}

export interface DeclarationOrderChecker<TNode, TSymbol, TType> {
  getSymbolAtLocation(node: TNode): TSymbol | undefined;
  getAliasedSymbol(symbol: TSymbol): TSymbol;
  getTypeFromTypeNode(node: TNode): TType;
  isTupleType(type: TType): boolean;
  getTypeArguments(type: TType): readonly TType[];
  getPropertiesOfType(type: TType): readonly TSymbol[];
  getPropertyOfType(type: TType, name: string): TSymbol | undefined;
  getTypeOfSymbol(symbol: TSymbol): TType;
}

type LiteralValue = string | number;

type LiteralMember<TType extends UnionMemberLike> = TType & { value: LiteralValue };

const MAX_DEPTH = 10;

const MAX_TEMPLATE_MEMBERS = 1000;

const NULLABLE_TEXTS = ['null', 'undefined'];

export function orderPropertiesByDeclaration<TSymbol extends DeclaredSymbolLike>(
  properties: readonly TSymbol[]
): TSymbol[] {
  const groups = Map.groupBy(
    properties,
    (property) => property.declarations?.[0]?.parent ?? property
  );
  return [...groups.values()].flatMap((group) =>
    group.toSorted((a, b) => (a.declarations?.[0]?.pos ?? 0) - (b.declarations?.[0]?.pos ?? 0))
  );
}

export function getDeclaredLiterals<
  TNode,
  TSymbol extends { flags: number; getName(): string; declarations?: readonly TNode[] },
  TType extends UnionMemberLike,
>(
  typescript: DeclarationOrderHost<TNode>,
  checker: DeclarationOrderChecker<TNode, TSymbol, TType>,
  node: TNode,
  depth = 0
): LiteralValue[] {
  const declared = (child: TNode) => getDeclaredLiterals(typescript, checker, child, depth + 1);
  if (depth > MAX_DEPTH) {
    return [];
  }
  if (typescript.isParenthesizedTypeNode(node)) {
    return declared(node.type);
  }
  if (typescript.isUnionTypeNode(node)) {
    return node.types.flatMap(declared);
  }
  if (typescript.isLiteralTypeNode(node)) {
    const { literal } = node;
    if (typescript.isStringLiteralLike(literal)) {
      return [literal.text];
    }
    if (typescript.isNumericLiteral(literal)) {
      return [Number(literal.text)];
    }
    return typescript.isPrefixUnaryExpression(literal) &&
      literal.operator === typescript.SyntaxKind.MinusToken &&
      typescript.isNumericLiteral(literal.operand)
      ? [-Number(literal.operand.text)]
      : [];
  }
  if (typescript.isTypeReferenceNode(node)) {
    const symbol = checker.getSymbolAtLocation(node.typeName);
    const target =
      symbol && symbol.flags & typescript.SymbolFlags.Alias
        ? checker.getAliasedSymbol(symbol)
        : symbol;
    if (
      target &&
      target.flags & (typescript.SymbolFlags.Enum | typescript.SymbolFlags.EnumMember)
    ) {
      const enumMembers =
        target.flags & typescript.SymbolFlags.Enum
          ? checker.getPropertiesOfType(checker.getTypeOfSymbol(target))
          : [target];
      return literalValues(enumMembers.map((member) => checker.getTypeOfSymbol(member)));
    }
    const aliased = (target?.declarations ?? []).flatMap((declaration) =>
      typescript.isTypeAliasDeclaration(declaration) ? declared(declaration.type) : []
    );
    return aliased.length > 0 ? aliased : (node.typeArguments ?? []).flatMap(declared);
  }
  if (typescript.isIndexedAccessTypeNode(node)) {
    const object = checker.getTypeFromTypeNode(node.objectType);
    if (checker.isTupleType(object)) {
      return literalValues(checker.getTypeArguments(object));
    }
    return [...new Set(declared(node.indexType).map(String))].flatMap((key) => {
      const property = checker.getPropertyOfType(object, key);
      if (!property) {
        return [];
      }
      const typed = (property.declarations ?? []).flatMap((declaration) =>
        (typescript.isPropertySignature(declaration) ||
          typescript.isPropertyDeclaration(declaration)) &&
        declaration.type
          ? declared(declaration.type)
          : []
      );
      return typed.length > 0 ? typed : literalValues([checker.getTypeOfSymbol(property)]);
    });
  }
  if (typescript.isTypeOperatorNode(node) && node.operator === typescript.SyntaxKind.KeyOfKeyword) {
    return checker
      .getPropertiesOfType(checker.getTypeFromTypeNode(node.type))
      .flatMap((property) => {
        const name = property.getName();
        return String(Number(name)) === name ? [name, Number(name)] : [name];
      });
  }
  if (typescript.isTemplateLiteralTypeNode(node)) {
    let texts = [node.head.text];
    for (const span of node.templateSpans) {
      const values = declared(span.type);
      if (values.length === 0 || texts.length * values.length > MAX_TEMPLATE_MEMBERS) {
        return [];
      }
      texts = texts.flatMap((text) => values.map((value) => `${text}${value}${span.literal.text}`));
    }
    return texts;
  }
  return [];
}

export function orderUnionMembers<TType extends UnionMemberLike>(
  typescript: DeclarationOrderFlags,
  members: readonly TType[],
  declared: readonly LiteralValue[]
): TType[] {
  const literals = members.filter((member) => !isNullable(typescript, member));
  if (literals.length < 2 || !literals.every(isLiteralMember)) {
    return [...members];
  }
  const position = (member: LiteralMember<TType>) => {
    const index = declared.indexOf(member.value);
    return index === -1 ? declared.length : index;
  };
  const sorted = literals.toSorted((a, b) => position(a) - position(b) || compareEnumMembers(a, b));
  let next = 0;
  return members.map((member) => (isNullable(typescript, member) ? member : sorted[next++]));
}

export function printUnionMembers<TType extends UnionMemberLike>(
  typescript: DeclarationOrderFlags,
  ordered: readonly TType[],
  text: string,
  print: (member: TType) => string
): string {
  const literals = ordered.filter((member) => !isNullable(typescript, member));
  if (!literals.every(isLiteralMember)) {
    return text;
  }
  const rank = new Map(literals.map((member, index) => [print(member), index]));
  const parts = splitUnionText(text);
  if (!parts || rank.size !== literals.length) {
    return text;
  }
  const listed = parts.filter((part) => !NULLABLE_TEXTS.includes(part));
  const shown = new Set(listed);
  const groups = listed.filter((part) => !rank.has(part));
  const grouped = [...rank].filter(([printed]) => !shown.has(printed)).map(([, index]) => index);
  if (groups.length > 1 || (groups.length === 0) !== (grouped.length === 0)) {
    return text;
  }
  const position = (part: string) => rank.get(part) ?? Math.min(...grouped);
  const sorted = listed.toSorted((a, b) => position(a) - position(b));
  let next = 0;
  return parts.map((part) => (NULLABLE_TEXTS.includes(part) ? part : sorted[next++])).join(' | ');
}

function literalValues(types: readonly UnionMemberLike[]): LiteralValue[] {
  return types.filter(isLiteralMember).map((type) => type.value);
}

function isLiteralMember<TType extends UnionMemberLike>(
  member: TType
): member is LiteralMember<TType> {
  return member.isStringLiteral() || member.isNumberLiteral();
}

function splitUnionText(text: string): string[] | undefined {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '\\') {
        index++;
      } else if (char === '"') {
        quoted = false;
      }
    } else if (char === '"') {
      quoted = true;
    } else if ('<([{'.includes(char)) {
      depth++;
    } else if ('>)]}'.includes(char)) {
      depth--;
    } else if (depth === 0 && text.startsWith(' | ', index)) {
      parts.push(text.slice(start, index));
      start = index + 3;
      index += 2;
    }
  }
  return depth === 0 && !quoted ? [...parts, text.slice(start)] : undefined;
}

function isNullable(typescript: DeclarationOrderFlags, member: UnionMemberLike): boolean {
  return !!(member.flags & (typescript.TypeFlags.Null | typescript.TypeFlags.Undefined));
}

function compareEnumMembers(a: UnionMemberLike, b: UnionMemberLike): number {
  const [declarationA, declarationB] = [a.symbol?.declarations?.[0], b.symbol?.declarations?.[0]];
  return declarationA && declarationB && declarationA.parent === declarationB.parent
    ? declarationA.pos - declarationB.pos
    : 0;
}
