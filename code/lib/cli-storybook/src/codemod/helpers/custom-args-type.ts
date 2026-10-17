import type { ESTree as E, ESTreeNode as Node, SourceEditor } from 'storybook/internal/csf-tools';

// `ComponentMeta` and `ComponentStory` are left out: their type argument is always a component.
const argsTypeNames = new Set(['Meta', 'MetaObj', 'Story', 'StoryFn', 'StoryObj']);

// Types that `&` binds tighter than, so they need parentheses in an intersection.
const LOOSER_THAN_INTERSECTION = new Set([
  'TSUnionType',
  'TSFunctionType',
  'TSConstructorType',
  'TSConditionalType',
]);

// The component is never a custom args type: `preview.meta()` infers its args from `component`.
export function customArgsTypes(editor: SourceEditor, component: Node | undefined) {
  const argsTypeLocalNames = new Set<string>();
  const typeAliases = new Map<string, E.TSType>();

  for (const node of editor.program.body) {
    if (node.type === 'ImportDeclaration') {
      for (const specifier of node.specifiers) {
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          argsTypeNames.has(specifier.imported.name)
        ) {
          argsTypeLocalNames.add(specifier.local.name);
        }
      }
    }

    const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
    if (declaration?.type === 'TSTypeAliasDeclaration' && !declaration.typeParameters) {
      typeAliases.set(declaration.id.name, declaration.typeAnnotation);
    }
  }

  // Two types are the same when their trees are, whatever the spacing and comments around them.
  const code = (type: Node) =>
    JSON.stringify(type, (key, value) => {
      if (key === 'start' || key === 'end') {
        return undefined;
      }
      // JSON has no bigint; a `1n` literal's value is one.
      return typeof value === 'bigint' ? `${value}n` : value;
    });

  // `Components.Button` is a MemberExpression as a value and a TSQualifiedName as a type.
  const dottedName = (node: Node | null | undefined): string | undefined => {
    if (node?.type === 'Identifier') {
      return node.name;
    }
    if (
      node?.type === 'MemberExpression' &&
      !node.computed &&
      node.property.type === 'Identifier'
    ) {
      const object = dottedName(node.object);
      return object && `${object}.${node.property.name}`;
    }
    if (node?.type === 'TSQualifiedName') {
      const left = dottedName(node.left);
      return left && `${left}.${node.right.name}`;
    }
    return undefined;
  };

  const componentName = dottedName(component);

  const isComponentClass = (type: Node | null | undefined): type is E.TSTypeReference =>
    type?.type === 'TSTypeReference' &&
    componentName !== undefined &&
    dottedName(type.typeName) === componentName;

  const isComponent = (type: Node | null | undefined) =>
    type?.type === 'TSTypeQuery' || isComponentClass(type);

  const aliasedType = (type: Node | null | undefined) =>
    type?.type === 'TSTypeReference' && !type.typeArguments && type.typeName.type === 'Identifier'
      ? typeAliases.get(type.typeName.name)
      : undefined;

  const isArgsType = (type: Node | null | undefined): type is E.TSTypeReference =>
    type?.type === 'TSTypeReference' &&
    type.typeName.type === 'Identifier' &&
    argsTypeLocalNames.has(type.typeName.name);

  const argsType = (type: Node | null | undefined) => [type, aliasedType(type)].find(isArgsType);

  const customArgs = (type: E.TSType | undefined): E.TSType[] =>
    (type?.type === 'TSIntersectionType' ? type.types : type ? [type] : []).flatMap((member) => {
      // `StoryObj<Meta<T>>` has the args of `Meta<T>`.
      const nested = argsType(member);
      if (nested) {
        return customArgs(nested.typeArguments?.params[0]);
      }
      const alias = aliasedType(member);
      // An alias that includes the component class is dropped: carried over, it would make every
      // member of that class a required arg.
      const includesComponent =
        isComponent(alias) ||
        (alias?.type === 'TSIntersectionType' && alias.types.some(isComponent));
      return isComponent(member) || includesComponent ? [] : [member];
    });

  return {
    read(annotation: Node | null | undefined): E.TSType[] {
      const type = annotation?.type === 'TSTypeAnnotation' ? annotation.typeAnnotation : annotation;
      return customArgs(argsType(type)?.typeArguments?.params[0]);
    },

    shared([first = [], ...rest]: E.TSType[][]): E.TSType[] {
      return first.filter((type) =>
        rest.every((types) => types.some((other) => code(other) === code(type)))
      );
    },

    // Source of `receiver`, or of `receiver.type<{ args: … }>()` for args types the meta lacks.
    typed(receiver: string, argsTypes: E.TSType[], metaArgsTypes: E.TSType[] = []): string {
      const metaCodes = new Set(metaArgsTypes.map(code));
      const distinctTypes = new Map<string, E.TSType>();
      for (const type of argsTypes) {
        if (!metaCodes.has(code(type))) {
          distinctTypes.set(code(type), type);
        }
      }
      if (distinctTypes.size === 0) {
        return receiver;
      }

      const types = [...distinctTypes.values()];
      const args =
        types.length > 1
          ? types
              .map((type) =>
                LOOSER_THAN_INTERSECTION.has(type.type)
                  ? `(${editor.source(type)})`
                  : editor.source(type)
              )
              .join(' & ')
          : editor.source(types[0]);
      return `${receiver}.type<{ args: ${args} }>()`;
    },
  };
}
