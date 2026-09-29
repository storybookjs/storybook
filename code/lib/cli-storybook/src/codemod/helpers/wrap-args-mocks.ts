import { types as t, traverse } from 'storybook/internal/babel';
import type { NodePath } from 'storybook/internal/babel';

const contextFunctionKeys = ['play', 'beforeEach', 'afterEach', 'loaders'];

const mockMembers = [
  'mock',
  'mockClear',
  'mockReset',
  'mockRestore',
  'mockName',
  'getMockName',
  'getMockImplementation',
  'mockImplementation',
  'mockImplementationOnce',
  'withImplementation',
  'mockReturnThis',
  'mockReturnValue',
  'mockReturnValueOnce',
  'mockResolvedValue',
  'mockResolvedValueOnce',
  'mockRejectedValue',
  'mockRejectedValueOnce',
];

function keyName(node: t.Node) {
  if (t.isIdentifier(node)) {
    return node.name;
  }
  return t.isStringLiteral(node) ? node.value : undefined;
}

function isContextFunction(path: NodePath<t.Function>) {
  if (path.isObjectMethod()) {
    return contextFunctionKeys.includes(keyName(path.node.key) ?? '');
  }
  const owner = path.parentPath.isArrayExpression() ? path.parentPath.parentPath : path.parentPath;
  return !!owner?.isObjectProperty() && contextFunctionKeys.includes(keyName(owner.node.key) ?? '');
}

function patternIdentifier(node: t.Node) {
  const target = t.isAssignmentPattern(node) ? node.left : node;
  return t.isIdentifier(target) ? target.name : undefined;
}

/** Names that the first parameter of a play function binds to the story context and its args. */
function contextNames(param: t.Node | undefined) {
  const names = { context: [] as string[], args: [] as string[], argValues: [] as string[] };
  const context = param && patternIdentifier(param);
  if (context) {
    names.context.push(context);
  }
  const pattern = t.isAssignmentPattern(param) ? param.left : param;
  if (!t.isObjectPattern(pattern)) {
    return names;
  }
  for (const property of pattern.properties) {
    if (!t.isObjectProperty(property) || keyName(property.key) !== 'args') {
      continue;
    }
    const args = patternIdentifier(property.value);
    if (args) {
      names.args.push(args);
    }
    const argsPattern = t.isAssignmentPattern(property.value)
      ? property.value.left
      : property.value;
    if (t.isObjectPattern(argsPattern)) {
      for (const arg of argsPattern.properties) {
        const name = t.isObjectProperty(arg) ? patternIdentifier(arg.value) : undefined;
        if (name) {
          names.argValues.push(name);
        }
      }
    }
  }
  return names;
}

/**
 * Wraps mock API access on args in `mocked()`, so `args.onClick.mockClear()` becomes
 * `mocked(args.onClick).mockClear()`. CSF factories type args as the component declares them, not
 * as `Mock`.
 */
export function wrapArgsMocks(ast: t.File) {
  const imports = ast.program.body.filter((node) => t.isImportDeclaration(node));
  const testImport = imports.find(
    (node) => node.source.value === 'storybook/test' && node.importKind !== 'type'
  );
  const existingMocked = testImport?.specifiers.find(
    (specifier) => t.isImportSpecifier(specifier) && keyName(specifier.imported) === 'mocked'
  );
  const mockedName = existingMocked?.local.name ?? 'mocked';
  let wrapped = false;

  traverse(ast, {
    Function(functionPath) {
      if (!isContextFunction(functionPath)) {
        return;
      }
      const names = contextNames(functionPath.node.params[0]);
      const isParam = (node: t.Node, path: NodePath, candidates: string[]) =>
        t.isIdentifier(node) &&
        candidates.includes(node.name) &&
        path.scope.getBinding(node.name) === functionPath.scope.getBinding(node.name);

      const isArgsObject = (node: t.Node, path: NodePath) =>
        isParam(node, path, names.args) ||
        (t.isMemberExpression(node) &&
          keyName(node.property) === 'args' &&
          isParam(node.object, path, names.context));

      functionPath.traverse({
        MemberExpression(path) {
          const { object, property, computed } = path.node;
          if (computed || !mockMembers.includes(keyName(property) ?? '')) {
            return;
          }
          const isArgValue =
            isParam(object, path, names.argValues) ||
            (t.isMemberExpression(object) && isArgsObject(object.object, path));
          if (isArgValue) {
            path.get('object').replaceWith(t.callExpression(t.identifier(mockedName), [object]));
            wrapped = true;
          }
        },
      });
    },
  });

  if (!wrapped || existingMocked) {
    return;
  }
  const mocked = t.importSpecifier(t.identifier('mocked'), t.identifier('mocked'));
  if (testImport) {
    testImport.specifiers.push(mocked);
  } else {
    const lastImport = imports.at(-1);
    const index = lastImport ? ast.program.body.indexOf(lastImport) + 1 : 0;
    ast.program.body.splice(
      index,
      0,
      t.importDeclaration([mocked], t.stringLiteral('storybook/test'))
    );
  }
}
