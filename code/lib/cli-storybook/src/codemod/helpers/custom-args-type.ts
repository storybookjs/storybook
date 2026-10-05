import { babelParse, generate, types as t } from 'storybook/internal/babel';

// `ComponentMeta` and `ComponentStory` are left out: their type argument is always a component.
const argsTypeNames = new Set(['Meta', 'MetaObj', 'Story', 'StoryFn', 'StoryObj']);

const typeReference = (name: string, ...typeArguments: t.TSType[]) =>
  t.tsTypeReference(t.identifier(name), t.tsTypeParameterInstantiation(typeArguments));

const keyName = (key: t.Node) =>
  t.isIdentifier(key) ? key.name : t.isStringLiteral(key) ? key.value : undefined;

// The component is never a custom args type: `preview.meta()` infers its args from `component`.
export function customArgsTypes(
  program: t.Program,
  component: t.Node | undefined,
  metaArgs: t.Node | undefined
) {
  const metaArgKeys = t.isObjectExpression(metaArgs)
    ? metaArgs.properties.flatMap((property) => {
        const name = t.isObjectProperty(property) && !property.computed && keyName(property.key);
        return name ? [name] : [];
      })
    : [];

  const argsTypeLocalNames = new Set<string>();
  const typeAliases = new Map<string, t.TSType>();
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

  const isArgsType = (type: t.Node | null | undefined): type is t.TSTypeReference =>
    t.isTSTypeReference(type) &&
    t.isIdentifier(type.typeName) &&
    argsTypeLocalNames.has(type.typeName.name);

  const argsType = (type: t.Node | null | undefined) => [type, aliasedType(type)].find(isArgsType);

  const customArgs = (type: t.TSType | undefined): t.TSType[] =>
    (t.isTSIntersectionType(type) ? type.types : type ? [type] : []).flatMap((member) => {
      if (t.isTSParenthesizedType(member)) {
        return customArgs(member.typeAnnotation);
      }
      // `StoryObj<Meta<T>>` has the args of `Meta<T>`.
      const nested = argsType(member);
      if (nested) {
        return customArgs(nested.typeParameters?.params[0]);
      }
      const alias = aliasedType(member);
      if (isComponent(member) || isComponent(alias)) {
        return [];
      }
      // A component class in the args type makes every member of that class a required arg.
      const componentClass = t.isTSIntersectionType(alias) && alias.types.find(isComponentClass);
      return componentClass
        ? [typeReference('Omit', member, t.tsTypeOperator(t.cloneNode(componentClass), 'keyof'))]
        : [member];
    });

  const code = (type: t.TSType) => generate(type, { comments: false }).code;

  const literalOf = (type: t.TSType) =>
    [type, aliasedType(type)].find((candidate) => t.isTSTypeLiteral(candidate));

  // `meta.type<T>()` makes an arg of the meta that `T` redeclares required again in the story.
  const withoutMetaArgs = (type: t.TSType) => {
    const literal = literalOf(type);
    const redeclares =
      !literal ||
      literal.members.some(
        (member) =>
          t.isTSPropertySignature(member) && metaArgKeys.includes(keyName(member.key) ?? '')
      );
    return metaArgKeys.length > 0 && redeclares
      ? typeReference(
          'Omit',
          type,
          t.tsUnionType(metaArgKeys.map((key) => t.tsLiteralType(t.stringLiteral(key))))
        )
      : type;
  };

  return {
    read(annotation: t.Node | null | undefined): t.TSType[] {
      const type = t.isTSTypeAnnotation(annotation) ? annotation.typeAnnotation : annotation;
      return customArgs(argsType(type)?.typeParameters?.params[0]);
    },

    shared([first = [], ...rest]: t.TSType[][]): t.TSType[] {
      return first.filter((type) =>
        rest.every((types) => types.some((other) => code(other) === code(type)))
      );
    },

    // Without `metaArgsTypes` the types are for `preview.type()`, with them for `meta.type()`.
    typed(receiver: string, argsTypes: t.TSType[], metaArgsTypes?: t.TSType[]): t.Expression {
      const metaCodes = new Set(metaArgsTypes?.map(code));
      const distinctTypes = new Map<string, t.TSType>();
      for (const argsType of argsTypes) {
        if (metaCodes.has(code(argsType)) || distinctTypes.has(code(argsType))) {
          continue;
        }
        let type = metaArgsTypes ? withoutMetaArgs(argsType) : argsType;
        // In Web Components the component is a tag name, so a type next to it that is not a type
        // literal is often the element class. `Partial` keeps its members optional, like the args
        // inferred from the component.
        if (isWebComponents && component && !literalOf(argsType)) {
          type = typeReference('Partial', type);
        }
        distinctTypes.set(code(argsType), type);
      }
      if (distinctTypes.size === 0) {
        return t.identifier(receiver);
      }

      // Parsed rather than built, as recast prints a type literal it did not parse over multiple lines.
      const [statement] = babelParse(`${receiver}.type<{ args: Args }>()`).program.body;
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
              types.map((type) => (t.isTSUnionType(type) ? t.tsParenthesizedType(type) : type))
            )
          : types[0]
      );

      return typed;
    },
  };
}
