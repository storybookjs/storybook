import { slash } from 'storybook/internal/common';
import {
  getDeclaredLiterals,
  orderPropertiesByDeclaration,
  orderUnionMembers,
  printUnionMembers,
} from 'storybook/internal/component-meta';

import type ts from 'typescript';
import type { ComponentMetaChecker } from 'vue-component-meta';

import type { MetaSource } from './component-meta.ts';

type PropMeta = MetaSource['props'][number];

export function orderMetaByDeclaration(
  meta: MetaSource,
  {
    checker,
    typescript,
    componentPath,
  }: { checker: ComponentMetaChecker; typescript: typeof ts; componentPath: string }
): MetaSource {
  const program = checker.getProgram();
  const sourceFile = program?.getSourceFile(slash(componentPath));
  if (!program || !sourceFile) {
    return meta;
  }
  const typeChecker = program.getTypeChecker();
  const properties = getPropsType(
    typescript,
    typeChecker,
    sourceFile,
    meta.exportName
  )?.getProperties();
  if (!properties) {
    return meta;
  }
  const byName = new Map(properties.map((property) => [property.getName(), property]));
  const rank = new Map(
    orderPropertiesByDeclaration(properties).map((property, index) => [property.getName(), index])
  );
  const known = meta.props.filter((prop) => rank.has(prop.name));
  const sorted = known.toSorted((a, b) => (rank.get(a.name) ?? 0) - (rank.get(b.name) ?? 0));
  return Object.assign({}, meta, {
    props: meta.props
      .map((prop) => (rank.has(prop.name) ? sorted[known.indexOf(prop)] : prop))
      .map((prop) => {
        const property = byName.get(prop.name);
        return property ? orderEnumSchema(typescript, typeChecker, prop, property) : prop;
      }),
  });
}

function getPropsType(
  typescript: typeof ts,
  typeChecker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  exportName: string
): ts.Type | undefined {
  const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
  const declaration = moduleSymbol
    ? typeChecker.getExportsOfModule(moduleSymbol).find((symbol) => symbol.getName() === exportName)
        ?.valueDeclaration
    : undefined;
  const componentNode = !declaration
    ? undefined
    : typescript.isExportAssignment(declaration)
      ? declaration.expression
      : typescript.isVariableDeclaration(declaration)
        ? declaration.initializer
        : undefined;
  if (!componentNode) {
    return undefined;
  }
  const componentType = typeChecker.getTypeAtLocation(componentNode);
  for (const signature of componentType.getConstructSignatures()) {
    const props = findPropertyType(typeChecker, signature.getReturnType(), '$props');
    if (props) {
      return props;
    }
  }
  for (const signature of componentType.getCallSignatures()) {
    const [props] = signature.parameters;
    if (props) {
      return typeChecker.getTypeOfSymbol(props);
    }
  }
  return undefined;
}

function findPropertyType(
  typeChecker: ts.TypeChecker,
  type: ts.Type,
  name: string
): ts.Type | undefined {
  const symbol = type.getProperty(name);
  if (symbol) {
    return typeChecker.getTypeOfSymbol(symbol);
  }
  if (!type.isUnionOrIntersection()) {
    return undefined;
  }
  for (const member of type.types) {
    const found = findPropertyType(typeChecker, member, name);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function orderEnumSchema(
  typescript: typeof ts,
  typeChecker: ts.TypeChecker,
  prop: PropMeta,
  property: ts.Symbol
): PropMeta {
  const { schema } = prop;
  const type = typeChecker.getTypeOfSymbol(property);
  if (typeof schema !== 'object' || schema.kind !== 'enum' || !schema.schema || !type.isUnion()) {
    return prop;
  }
  const items = schema.schema;
  const members = type.types;
  const texts = members.map((member) => typeText(typescript, typeChecker, member));
  const schemaTexts = items.map((item) => (typeof item === 'string' ? item : item.type));
  if (schemaTexts.length !== texts.length || schemaTexts.some((text, i) => text !== texts[i])) {
    return prop;
  }
  const declared = declaredTypeNodes(typescript, property).flatMap((node) =>
    getDeclaredLiterals(typescript, typeChecker, node)
  );
  const ordered = orderUnionMembers(typescript, members, declared);
  const reprint = (text: string) =>
    printUnionMembers(typescript, ordered, text, (member) => texts[members.indexOf(member)]);
  return {
    ...prop,
    type: reprint(prop.type),
    schema: {
      ...schema,
      type: reprint(schema.type),
      schema: ordered.map((member) => items[members.indexOf(member)]),
    },
  };
}

function typeText(typescript: typeof ts, typeChecker: ts.TypeChecker, type: ts.Type): string {
  return typeChecker
    .typeToString(
      type,
      undefined,
      typescript.TypeFormatFlags.UseFullyQualifiedType | typescript.TypeFormatFlags.NoTruncation
    )
    .replace(/import\(.*?\)\./g, '');
}

function declaredTypeNodes(typescript: typeof ts, property: ts.Symbol): ts.TypeNode[] {
  return (property.declarations ?? []).flatMap((declaration) => {
    if (
      typescript.isPropertySignature(declaration) ||
      typescript.isPropertyDeclaration(declaration)
    ) {
      return declaration.type ? [declaration.type] : [];
    }
    if (
      !typescript.isPropertyAssignment(declaration) ||
      !typescript.isObjectLiteralExpression(declaration.initializer)
    ) {
      return [];
    }
    const typeOption = declaration.initializer.properties.find(
      (option): option is ts.PropertyAssignment =>
        typescript.isPropertyAssignment(option) &&
        typescript.isIdentifier(option.name) &&
        option.name.text === 'type'
    );
    const assertion = typeOption?.initializer;
    return assertion &&
      typescript.isAsExpression(assertion) &&
      typescript.isTypeReferenceNode(assertion.type) &&
      assertion.type.typeArguments?.length === 1
      ? [assertion.type.typeArguments[0]]
      : [];
  });
}
