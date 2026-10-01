import { babelParse, generate, types as t } from 'storybook/internal/babel';

// `ComponentMeta` and `ComponentStory` are left out: their type argument is always a component.
const argsTypeNames = new Set(['Meta', 'MetaObj', 'Story', 'StoryFn', 'StoryObj']);

const needsParentheses = (type: t.TSType) =>
  t.isTSUnionType(type) ||
  t.isTSFunctionType(type) ||
  t.isTSConstructorType(type) ||
  t.isTSConditionalType(type);

const typeReference = (name: string, ...typeArguments: t.TSType[]) =>
  t.tsTypeReference(t.identifier(name), t.tsTypeParameterInstantiation(typeArguments));

// The component is never a custom args type: `preview.meta()` infers its args from `component`.
export function customArgsTypes(program: t.Program, component: t.Node | undefined) {
  const argsTypeLocalNames = new Set<string>();
  const typeAliases = new Map<string, t.TSType>();
  let isAngular = false;
  let isWebComponents = false;

  for (const node of program.body) {
    if (t.isImportDeclaration(node)) {
      for (const specifier of node.specifiers) {
        if (
          t.isImportSpecifier(specifier) &&
          t.isIdentifier(specifier.imported) &&
          argsTypeNames.has(specifier.imported.name)
        ) {
          argsTypeLocalNames.add(specifier.local.name);
        }
      }
      isAngular ||= /^@storybook\/angular(-|$)/.test(node.source.value);
      isWebComponents ||= /^@storybook\/web-components(-|$)/.test(node.source.value);
    }

    const declaration = t.isExportNamedDeclaration(node) ? node.declaration : node;
    if (t.isTSTypeAliasDeclaration(declaration) && !declaration.typeParameters) {
      typeAliases.set(declaration.id.name, declaration.typeAnnotation);
    }
  }

  const componentCode = component && generate(component).code;

  const isComponentClass = (type: t.Node | null | undefined): type is t.TSTypeReference =>
    t.isTSTypeReference(type) && generate(type.typeName).code === componentCode;

  const isComponent = (type: t.Node | null | undefined) =>
    t.isTSTypeQuery(type) || isComponentClass(type);

  const aliasedType = (type: t.Node | null | undefined) =>
    t.isTSTypeReference(type) && !type.typeParameters && t.isIdentifier(type.typeName)
      ? typeAliases.get(type.typeName.name)
      : undefined;

  const typeArgument = (type: t.Node | null | undefined) =>
    t.isTSTypeReference(type) &&
    t.isIdentifier(type.typeName) &&
    argsTypeLocalNames.has(type.typeName.name)
      ? type.typeParameters?.params[0]
      : undefined;

  return {
    read(annotation: t.Node | null | undefined): t.TSType[] {
      const type = t.isTSTypeAnnotation(annotation) ? annotation.typeAnnotation : annotation;
      const argsType = typeArgument(type) ?? typeArgument(aliasedType(type));
      if (!argsType) {
        return [];
      }
      return (t.isTSIntersectionType(argsType) ? argsType.types : [argsType]).flatMap<t.TSType>(
        (member) => {
          const alias = aliasedType(member);
          if (isComponent(member) || isComponent(alias)) {
            return [];
          }
          // A component class in the args type makes every member of that class a required arg.
          const componentClass =
            t.isTSIntersectionType(alias) && alias.types.find(isComponentClass);
          return componentClass
            ? [typeReference('Omit', member, t.tsTypeOperator(componentClass, 'keyof'))]
            : [member];
        }
      );
    },

    typedPreview(
      previewName: string,
      metaArgsTypes: t.TSType[],
      storyArgsTypes: t.TSType[]
    ): t.Expression {
      const distinctTypes = new Map<string, t.TSType>();
      for (const [types, optional] of [
        // The `component` of Web Components is a tag name, so a type next to it describes that
        // component, whose args are inferred as optional.
        [metaArgsTypes, isWebComponents && !!component],
        // Angular and Web Components never required an arg of a story in CSF 3.
        [storyArgsTypes, isAngular || isWebComponents],
      ] as const) {
        for (const type of types) {
          const code = generate(type, { comments: false }).code;
          if (!distinctTypes.has(code)) {
            distinctTypes.set(code, optional ? typeReference('Partial', type) : type);
          }
        }
      }
      if (distinctTypes.size === 0) {
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

      const types = [...distinctTypes.values()];
      args.typeAnnotation = t.tsTypeAnnotation(
        types.length > 1
          ? t.tsIntersectionType(
              types.map((type) => (needsParentheses(type) ? t.tsParenthesizedType(type) : type))
            )
          : types[0]
      );

      return typed;
    },
  };
}
