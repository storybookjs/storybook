import type { ESTree as E, ESTreeNode as Node, SourceEditor } from 'storybook/internal/csf-tools';

// `ComponentMeta` and `ComponentStory` are left out: their type argument is always a component.
const argsTypeNames = new Set(['Meta', 'MetaObj', 'Story', 'StoryFn', 'StoryObj']);

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

  // Whitespace and comments do not make two types different.
  const code = (type: Node) =>
    editor
      .source(type)
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

  const componentCode = component && code(component);

  const isComponentClass = (type: Node | null | undefined): type is E.TSTypeReference =>
    type?.type === 'TSTypeReference' && code(type.typeName) === componentCode;

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
      if (member.type === 'TSParenthesizedType') {
        return customArgs(member.typeAnnotation);
      }
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
                type.type === 'TSUnionType' || type.type === 'TSFunctionType'
                  ? `(${editor.source(type)})`
                  : editor.source(type)
              )
              .join(' & ')
          : editor.source(types[0]);
      return `${receiver}.type<{ args: ${args} }>()`;
    },
  };
}
