import { types as t, traverse } from 'storybook/internal/babel';
import type { NodePath } from 'storybook/internal/babel';

type Binding = NonNullable<ReturnType<NodePath['scope']['getBinding']>>;

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

function withoutDefault(node: t.Node) {
  return t.isAssignmentPattern(node) ? node.left : node;
}

function isMember(node: t.Node): node is t.MemberExpression | t.OptionalMemberExpression {
  return (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) && !node.computed;
}

// Wraps mock API access on args in `mocked()`, so `args.onClick.mockClear()` becomes
// `mocked(args.onClick).mockClear()`. CSF factories type args as the component declares them.
export function wrapArgsMocks(ast: t.File) {
  const argsObjects = new Set<Binding>();
  const argValues = new Set<Binding>();
  const targets: NodePath<t.Expression>[] = [];
  let program: NodePath<t.Program> | undefined;

  const bindingOf = (path: NodePath, node: t.Node | undefined) =>
    t.isIdentifier(node) ? path.scope.getBinding(node.name) : undefined;

  const isBoundIn = (bindings: Set<Binding>, path: NodePath, node: t.Node) => {
    const binding = bindingOf(path, node);
    return !!binding && bindings.has(binding);
  };

  const bind = (bindings: Set<Binding>, path: NodePath, node: t.Node | undefined) => {
    const binding = bindingOf(path, node);
    if (binding) {
      bindings.add(binding);
    }
  };

  const isArgsObject = (path: NodePath, node: t.Node) =>
    isBoundIn(argsObjects, path, node) || (isMember(node) && keyName(node.property) === 'args');

  const addArgs = (path: NodePath, pattern: t.Node) => {
    const target = withoutDefault(pattern);
    bind(argsObjects, path, target);
    if (t.isObjectPattern(target)) {
      for (const property of target.properties) {
        if (t.isObjectProperty(property)) {
          bind(argValues, path, withoutDefault(property.value));
        }
      }
    }
  };

  const addContext = (path: NodePath, pattern: t.Node | undefined) => {
    const target = pattern && withoutDefault(pattern);
    if (!t.isObjectPattern(target)) {
      return;
    }
    for (const property of target.properties) {
      if (t.isObjectProperty(property) && keyName(property.key) === 'args') {
        addArgs(path, property.value);
      }
    }
  };

  const collectTarget = (path: NodePath<t.MemberExpression | t.OptionalMemberExpression>) => {
    const { object, property, computed } = path.node;
    if (computed || !mockMembers.includes(keyName(property) ?? '')) {
      return;
    }
    if (
      isBoundIn(argValues, path, object) ||
      (isMember(object) && isArgsObject(path, object.object))
    ) {
      targets.push(path.get('object'));
    }
  };

  traverse(ast, {
    Program(path) {
      program = path;
    },
    Function(path) {
      addContext(path, path.node.params[0]);
    },
    VariableDeclarator(path) {
      const { id, init } = path.node;
      if (init && isArgsObject(path, init)) {
        addArgs(path, id);
      } else {
        addContext(path, id);
      }
    },
    MemberExpression: collectTarget,
    OptionalMemberExpression: collectTarget,
  });

  if (targets.length === 0 || !program) {
    return;
  }

  const testImports = ast.program.body.filter(
    (node): node is t.ImportDeclaration =>
      t.isImportDeclaration(node) &&
      node.source.value === 'storybook/test' &&
      node.importKind !== 'type'
  );
  const specifiers = testImports.flatMap((node) => node.specifiers);
  const existing = specifiers.find(
    (specifier) => t.isImportSpecifier(specifier) && keyName(specifier.imported) === 'mocked'
  );
  const namespace = specifiers.find((specifier) => t.isImportNamespaceSpecifier(specifier));

  let callee: () => t.Expression;
  if (existing) {
    callee = () => t.identifier(existing.local.name);
  } else if (namespace) {
    callee = () => t.memberExpression(t.identifier(namespace.local.name), t.identifier('mocked'));
  } else {
    const name = targets.some((target) => target.scope.hasBinding('mocked'))
      ? program.scope.generateUidIdentifier('mocked').name
      : 'mocked';
    callee = () => t.identifier(name);
    const specifier = t.importSpecifier(t.identifier(name), t.identifier('mocked'));
    const namedImport = testImports.find((node) =>
      node.specifiers.every((s) => !t.isImportNamespaceSpecifier(s))
    );
    if (namedImport) {
      namedImport.specifiers.push(specifier);
    } else {
      const lastImport = ast.program.body.findLastIndex((node) => t.isImportDeclaration(node));
      ast.program.body.splice(
        lastImport + 1,
        0,
        t.importDeclaration([specifier], t.stringLiteral('storybook/test'))
      );
    }
  }

  for (const target of targets) {
    target.replaceWith(t.callExpression(callee(), [target.node]));
  }
}
