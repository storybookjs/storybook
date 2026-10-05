import { babelParse, generate, types as t } from 'storybook/internal/babel';

// `ComponentMeta` and `ComponentStory` are left out: their type argument is always a component.
const argsTypeNames = new Set(['Meta', 'MetaObj', 'Story', 'StoryFn', 'StoryObj']);

const typeReference = (name: string, ...typeArguments: t.TSType[]) =>
  t.tsTypeReference(t.identifier(name), t.tsTypeParameterInstantiation(typeArguments));

// The component is never a custom args type: `preview.meta()` infers its args from `component`.
export function customArgsTypes(program: t.Program, component: t.Node | undefined) {
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

    typed(receiver: string, argsTypes: t.TSType[], metaArgsTypes: t.TSType[] = []): t.Expression {
      // In Web Components the component is a tag name, so the type next to it is often the element
      // class. `Partial` keeps its members optional, like the args inferred from the component.
      const optional = isWebComponents && !!component;
      const metaCodes = new Set(metaArgsTypes.map(code));
      const distinctTypes = new Map<string, t.TSType>();
      for (const type of argsTypes) {
        if (!metaCodes.has(code(type)) && !distinctTypes.has(code(type))) {
          distinctTypes.set(code(type), optional ? typeReference('Partial', type) : type);
        }
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
