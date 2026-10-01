import { babelParse, generate, types as t } from 'storybook/internal/babel';

// `ComponentMeta` and `ComponentStory` are left out: their type argument is always a component.
const argsTypeNames = new Set(['Meta', 'MetaObj', 'Story', 'StoryFn', 'StoryObj']);

const needsParentheses = (type: t.TSType) =>
  t.isTSUnionType(type) ||
  t.isTSFunctionType(type) ||
  t.isTSConstructorType(type) ||
  t.isTSConditionalType(type);

const typeReference = (name: string, typeArgument: t.TSType) =>
  t.tsTypeReference(t.identifier(name), t.tsTypeParameterInstantiation([typeArgument]));

// The component is never a custom args type: `preview.meta()` infers its args from `component`.
export function customArgsTypes(program: t.Program, component: t.Node | undefined) {
  const importedNames = new Map<string, string>();
  const typeAliases = new Map<string, t.TSType>();
  let angularImport: t.ImportDeclaration | undefined;
  let isWebComponents = false;

  for (const node of program.body) {
    if (t.isImportDeclaration(node)) {
      for (const specifier of node.specifiers) {
        if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
          importedNames.set(specifier.local.name, specifier.imported.name);
        }
      }
      if (/^@storybook\/angular(-|$)/.test(node.source.value)) {
        // A namespace import cannot take the named import that `typedPreview` adds.
        angularImport = node.specifiers.some(t.isImportSpecifier) ? node : angularImport;
      }
      isWebComponents ||= /^@storybook\/web-components(-|$)/.test(node.source.value);
    }

    const declaration = t.isExportNamedDeclaration(node) ? node.declaration : node;
    if (t.isTSTypeAliasDeclaration(declaration) && !declaration.typeParameters) {
      typeAliases.set(declaration.id.name, declaration.typeAnnotation);
    }
  }

  const componentCode = component && generate(component).code;

  const isComponent = (type: t.Node | null | undefined) =>
    t.isTSTypeQuery(type) ||
    (t.isTSTypeReference(type) && generate(type.typeName).code === componentCode);

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

  return {
    read(annotation: t.Node | null | undefined): t.TSType[] {
      const type = t.isTSTypeAnnotation(annotation) ? annotation.typeAnnotation : annotation;
      const argsType = typeArgument(type) ?? typeArgument(aliasedType(type));
      if (!argsType) {
        return [];
      }
      return (t.isTSIntersectionType(argsType) ? argsType.types : [argsType]).filter(
        (member) => !isComponent(member) && !isComponent(aliasedType(member))
      );
    },

    typedPreview(previewName: string, argsTypes: t.TSType[]): t.Expression {
      const distinctTypes = [
        ...new Map(
          argsTypes.map((type) => [generate(type, { comments: false }).code, type])
        ).values(),
      ];
      if (distinctTypes.length === 0) {
        return t.identifier(previewName);
      }

      let argsType =
        distinctTypes.length > 1
          ? t.tsIntersectionType(
              distinctTypes.map((type) =>
                needsParentheses(type) ? t.tsParenthesizedType(type) : type
              )
            )
          : distinctTypes[0];

      // CSF 3 never required an arg in Angular and Web Components, and CSF Next infers the args of
      // their components as optional. The type that is carried over must not be stricter than that.
      if (angularImport && !distinctTypes.every((type) => t.isTSTypeLiteral(type))) {
        // What `Meta<T>` of Angular applies to `T`: an output becomes a callback, a signal its value.
        // A type that is not written out here may include a component class, which has those.
        const transform = 'TransformComponentType';
        if (!angularImport.specifiers.some((specifier) => specifier.local.name === transform)) {
          const specifier = t.importSpecifier(t.identifier(transform), t.identifier(transform));
          specifier.importKind = angularImport.importKind === 'type' ? null : 'type';
          angularImport.specifiers.push(specifier);
        }
        argsType = typeReference(transform, argsType);
      }
      if (angularImport || (isWebComponents && component)) {
        argsType = typeReference('Partial', argsType);
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
      args.typeAnnotation = t.tsTypeAnnotation(argsType);

      return typed;
    },
  };
}
