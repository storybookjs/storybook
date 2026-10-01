import { babelParse, generate, types as t } from 'storybook/internal/babel';

// `ComponentMeta` and `ComponentStory` are left out: their type argument is always a component.
const argsTypeNames = new Set(['Meta', 'MetaObj', 'Story', 'StoryFn', 'StoryObj']);

// The component is never a custom args type: `preview.meta()` infers its args from `component`.
export function customArgsTypesReader(program: t.Program, component: t.Node | undefined) {
  const importedNames = new Map<string, string>();
  const typeAliases = new Map<string, t.TSType>();

  for (const node of program.body) {
    if (t.isImportDeclaration(node)) {
      for (const specifier of node.specifiers) {
        if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
          importedNames.set(specifier.local.name, specifier.imported.name);
        }
      }
    }

    const declaration = t.isExportNamedDeclaration(node) ? node.declaration : node;
    if (t.isTSTypeAliasDeclaration(declaration) && !declaration.typeParameters) {
      typeAliases.set(declaration.id.name, declaration.typeAnnotation);
    }
    // An interface includes the types that it extends, as an intersection does.
    if (t.isTSInterfaceDeclaration(declaration) && !declaration.typeParameters) {
      typeAliases.set(
        declaration.id.name,
        t.tsIntersectionType(
          (declaration.extends ?? []).map((parent) =>
            t.tsTypeReference(parent.expression, parent.typeParameters)
          )
        )
      );
    }
  }

  const componentCode = component && generate(component).code;

  const isComponentClass = (type: t.TSType) =>
    t.isTSTypeReference(type) && generate(type.typeName).code === componentCode;

  const isComponent = (type: t.TSType) => t.isTSTypeQuery(type) || isComponentClass(type);

  const aliasedType = (type: t.Node | null | undefined) =>
    t.isTSTypeReference(type) && !type.typeParameters && t.isIdentifier(type.typeName)
      ? typeAliases.get(type.typeName.name)
      : undefined;

  const typeArgument = (type: t.Node | null | undefined) =>
    t.isTSTypeReference(type) &&
    t.isIdentifier(type.typeName) &&
    argsTypeNames.has(importedNames.get(type.typeName.name) ?? '')
      ? type.typeParameters?.params[0]
      : undefined;

  const customArgsTypes = (type: t.TSType): t.TSType[] =>
    (t.isTSIntersectionType(type) ? type.types : [type]).flatMap((member) => {
      const alias = aliasedType(member);
      if (isComponent(member) || (alias && isComponent(alias))) {
        return [];
      }

      const componentClass = t.isTSIntersectionType(alias) && alias.types.find(isComponentClass);
      if (!componentClass) {
        return [member];
      }
      // An args type that includes the component class makes every member of that class a required arg.
      return [
        t.tsTypeReference(
          t.identifier('Omit'),
          t.tsTypeParameterInstantiation([member, t.tsTypeOperator(componentClass, 'keyof')])
        ),
      ];
    });

  return (annotation: t.Node | null | undefined): t.TSType[] => {
    const type = t.isTSTypeAnnotation(annotation) ? annotation.typeAnnotation : annotation;
    const argsType = typeArgument(type) ?? typeArgument(aliasedType(type));
    return argsType ? customArgsTypes(argsType) : [];
  };
}

const needsParentheses = (type: t.TSType) =>
  t.isTSUnionType(type) ||
  t.isTSFunctionType(type) ||
  t.isTSConstructorType(type) ||
  t.isTSConditionalType(type);

export function typedPreview(previewName: string, customArgsTypes: t.TSType[]): t.Expression {
  const distinctTypes = [
    ...new Map(
      customArgsTypes.map((type) => [generate(type, { comments: false }).code, type])
    ).values(),
  ];
  if (distinctTypes.length === 0) {
    return t.identifier(previewName);
  }

  // Parsed rather than built, as recast prints a type literal it did not parse over multiple lines.
  const [statement] = babelParse(`${previewName}.type<{ args: Args }>()`).program.body;
  t.assertExpressionStatement(statement);
  const typed = statement.expression;
  t.assertCallExpression(typed);
  const typeLiteral = typed.typeParameters?.params[0];
  t.assertTSTypeLiteral(typeLiteral);
  const [args] = typeLiteral.members;
  t.assertTSPropertySignature(args);

  args.typeAnnotation = t.tsTypeAnnotation(
    distinctTypes.length > 1
      ? t.tsIntersectionType(
          distinctTypes.map((type) => (needsParentheses(type) ? t.tsParenthesizedType(type) : type))
        )
      : distinctTypes[0]
  );

  return typed;
}
