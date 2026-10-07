import {
  babelParse,
  babelPrint,
  traverse,
  types as t,
  type NodePath,
} from 'storybook/internal/babel';

import picocolors from 'picocolors';

import type { Fix } from '../types.ts';

const tagOptionRenames = {
  excludeFromSidebar: 'hideFromSidebar',
  excludeFromDocsStories: 'hideFromAutodocs',
} as const;

const objectKeys = (node: t.ObjectExpression) =>
  node.properties.flatMap((property) => {
    if (!t.isObjectProperty(property) || property.computed) {
      return [];
    }
    if (t.isIdentifier(property.key)) {
      return [property.key.name];
    }
    if (t.isStringLiteral(property.key)) {
      return [property.key.value];
    }
    return [];
  });

const setFilterRenames: Record<string, string> = Object.assign(Object.create(null), {
  experimental_setFilters: 'setFilters',
  experimental_setFilter: 'setFilter',
});

const isManagerApiImport = (path: NodePath<t.Identifier>, importedName: string) => {
  const binding = path.scope.getBinding(path.node.name);
  return (
    binding?.path.isImportSpecifier() === true &&
    t.isIdentifier(binding.path.node.imported, { name: importedName }) &&
    binding.path.parentPath.isImportDeclaration() &&
    ['storybook/manager-api', '@storybook/manager-api'].includes(
      binding.path.parentPath.node.source.value
    )
  );
};

const isStorybookApi = (path: NodePath<t.Identifier>): boolean => {
  const binding = path.scope.getBinding(path.node.name);
  if (!binding?.constant) {
    return false;
  }
  if (binding.path.isVariableDeclarator()) {
    const init = binding.path.get('init') as NodePath<t.Expression | null>;
    if (!init.isCallExpression()) {
      return false;
    }
    const callee = init.get('callee');
    return callee.isIdentifier() && isManagerApiImport(callee, 'useStorybookApi');
  }
  if (!binding.path.isIdentifier()) {
    return false;
  }
  const callback = binding.path.parentPath;
  if (!callback.isArrowFunctionExpression() && !callback.isFunctionExpression()) {
    return false;
  }
  const call = callback.parentPath;
  if (!call.isCallExpression() || !call.node.arguments.includes(callback.node)) {
    return false;
  }
  const callee = call.get('callee');
  if (!callee.isMemberExpression() || !t.isIdentifier(callee.node.property, { name: 'register' })) {
    return false;
  }
  const object = callee.get('object');
  return object.isIdentifier() && isManagerApiImport(object, 'addons');
};

const isSetFilterApiReference = (path: NodePath<t.Identifier>) => {
  const { parent, parentPath } = path;
  if (
    (parentPath.isMemberExpression() || parentPath.isOptionalMemberExpression()) &&
    !parentPath.node.computed &&
    parentPath.node.property === path.node
  ) {
    const object = parentPath.get('object') as NodePath<t.Expression>;
    return object.isIdentifier() && isStorybookApi(object);
  }
  const isDestructuredApiKey =
    t.isObjectProperty(parent) &&
    !parent.computed &&
    parent.key === path.node &&
    parentPath.parentPath?.isObjectPattern() === true;
  if (!isDestructuredApiKey) {
    return false;
  }
  const declarator = parentPath.parentPath?.parentPath;
  if (!declarator?.isVariableDeclarator()) {
    return false;
  }
  const init = declarator.get('init');
  return init.isIdentifier() && isStorybookApi(init);
};

const renameSetFilterIdentifiers = (code: string) => {
  if (!code.includes('experimental_setFilter')) {
    return undefined;
  }
  let ast;
  try {
    ast = babelParse(code);
  } catch {
    return undefined;
  }
  let changed = false;
  traverse(ast, {
    Identifier(path) {
      if (!isSetFilterApiReference(path)) {
        return;
      }
      const next = Object.hasOwn(setFilterRenames, path.node.name)
        ? setFilterRenames[path.node.name]
        : undefined;
      if (!next) {
        return;
      }
      path.node.name = next;
      changed = true;
    },
  });
  if (!changed) {
    return undefined;
  }
  const printed = babelPrint(ast);
  return printed === code ? undefined : printed;
};

export const tagFilterApi: Fix = {
  id: 'tag-filter-api',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#tag-filtering-api',

  prompt: () =>
    `Rename the old tag filter options to ${picocolors.cyan('hideFromSidebar')}, ${picocolors.cyan('hideFromAutodocs')}, and ${picocolors.cyan('setFilter')}`,

  transform: () => [
    {
      filter: { kind: ['main'], code: /excludeFromSidebar|excludeFromDocsStories/ },
      editConfig: (main) => {
        const tags = main.get(['tags']);
        if (!tags || !t.isObjectExpression(tags)) {
          return;
        }
        for (const tagName of objectKeys(tags)) {
          const option = main.get(['tags', tagName]);
          if (!option || !t.isObjectExpression(option)) {
            continue;
          }
          const keys = new Set(objectKeys(option));
          for (const [from, to] of Object.entries(tagOptionRenames)) {
            if (!keys.has(from)) {
              continue;
            }
            if (keys.has(to)) {
              const fromNode = main.get(['tags', tagName, from]);
              const toNode = main.get(['tags', tagName, to]);
              const fromTrue =
                !!fromNode && t.isBooleanLiteral(fromNode) && fromNode.value === true;
              const toTrue = !!toNode && t.isBooleanLiteral(toNode) && toNode.value === true;
              if (fromTrue && !toTrue) {
                main.set(['tags', tagName, to], true);
              }
              main.remove(['tags', tagName, from]);
            } else {
              main.rename(['tags', tagName, from], to);
            }
          }
        }
      },
    },
    {
      filter: {
        kind: ['manager', 'preview', 'story', 'config'],
        code: 'experimental_setFilter',
      },
      handler: renameSetFilterIdentifiers,
    },
  ],
};
