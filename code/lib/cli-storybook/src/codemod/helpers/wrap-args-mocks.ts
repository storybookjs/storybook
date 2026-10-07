import {
  type Binding,
  type ESTree as E,
  type ESTreeNode as Node,
  type SourceEditor,
  generateUid,
  walk,
} from 'storybook/internal/csf-tools';

import { setImportSpecifiers } from '../../automigrate/helpers/source-edits.ts';

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

function keyName(node: Node) {
  if (node.type === 'Identifier') {
    return node.name;
  }
  return node.type === 'Literal' && typeof node.value === 'string' ? node.value : undefined;
}

function withoutDefault(node: Node) {
  return node.type === 'AssignmentPattern' ? node.left : node;
}

function withoutTypeCast(node: Node): Node {
  return node.type === 'TSNonNullExpression' ||
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression'
    ? withoutTypeCast(node.expression)
    : node;
}

const isTypeCast = (node: Node) =>
  node.type === 'TSAsExpression' ||
  node.type === 'TSSatisfiesExpression' ||
  node.type === 'TSNonNullExpression';

function isRender(editor: SourceEditor, fn: Node) {
  let value = fn;
  let owner = editor.parentOf(fn);
  while (owner && isTypeCast(owner)) {
    value = owner;
    owner = editor.parentOf(owner);
  }
  return owner?.type === 'Property' && owner.value === value && keyName(owner.key) === 'render';
}

function isMember(node: Node): node is E.MemberExpression {
  return (
    node.type === 'MemberExpression' &&
    (!node.computed ||
      (node.property.type === 'Literal' && typeof node.property.value === 'string'))
  );
}

// Wraps mock API access on args in `mocked()`, so `args.onClick.mockClear()` becomes
// `mocked(args.onClick).mockClear()`. CSF factories type args as the component declares them.
// Leaves the edits pending on `editor`.
export function wrapArgsMocks(editor: SourceEditor) {
  const { scopes, program } = editor;
  const argsObjects = new Set<Binding>();
  const argValues = new Set<Binding>();
  const targets: Node[] = [];

  const bindingOf = (node: Node | undefined) =>
    node?.type === 'Identifier' ? scopes.bindingOf(node) : undefined;

  const isBoundIn = (bindings: Set<Binding>, node: Node) => {
    const binding = bindingOf(node);
    return !!binding && bindings.has(binding);
  };

  const bind = (bindings: Set<Binding>, node: Node | undefined) => {
    const binding = bindingOf(node);
    if (binding) {
      bindings.add(binding);
    }
  };

  const isArgsObject = (expression: Node) => {
    const node = withoutTypeCast(expression);
    return isBoundIn(argsObjects, node) || (isMember(node) && keyName(node.property) === 'args');
  };

  const addArgs = (pattern: Node) => {
    const target = withoutDefault(pattern);
    bind(argsObjects, target);
    if (target.type === 'ObjectPattern') {
      for (const property of target.properties) {
        if (property.type === 'Property') {
          bind(argValues, withoutDefault(property.value));
        }
      }
    }
  };

  const addContext = (pattern: Node | undefined) => {
    const target = pattern && withoutDefault(pattern);
    if (target?.type !== 'ObjectPattern') {
      return;
    }
    for (const property of target.properties) {
      if (property.type === 'Property' && keyName(property.key) === 'args') {
        addArgs(property.value);
      }
    }
  };

  const collectTarget = (node: E.MemberExpression) => {
    if (!isMember(node) || !mockMembers.includes(keyName(node.property) ?? '')) {
      return;
    }
    if (node.object.type === 'TSAsExpression') {
      return;
    }
    const object = withoutTypeCast(node.object);
    if (isBoundIn(argValues, object) || (isMember(object) && isArgsObject(object.object))) {
      targets.push(node.object);
    }
  };

  walk(program, (node) => {
    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression'
    ) {
      node.params.forEach((param, index) => {
        if (index === 0 && isRender(editor, node)) {
          addArgs(param);
        } else {
          addContext(param);
        }
      });
    } else if (node.type === 'VariableDeclarator') {
      const { id, init } = node;
      const value = init && withoutTypeCast(init);
      if (init && isArgsObject(init)) {
        addArgs(id);
      } else if (value && isMember(value) && isArgsObject(value.object)) {
        bind(argValues, id);
      } else {
        addContext(id);
      }
    } else if (node.type === 'MemberExpression') {
      collectTarget(node);
    }
  });

  if (targets.length === 0) {
    return;
  }

  const testImports = program.body.filter(
    (node): node is E.ImportDeclaration =>
      node.type === 'ImportDeclaration' &&
      node.source.value === 'storybook/test' &&
      node.importKind !== 'type'
  );
  const specifiers = testImports.flatMap((node) => node.specifiers);
  const existing = specifiers.find(
    (specifier): specifier is E.ImportSpecifier =>
      specifier.type === 'ImportSpecifier' &&
      specifier.importKind !== 'type' &&
      keyName(specifier.imported) === 'mocked'
  );
  const namespace = specifiers.find((specifier) => specifier.type === 'ImportNamespaceSpecifier');

  const lookup = (target: Node, name: string) => scopes.scopeOf(target).lookup(name);
  const isUnshadowed = (name: string) =>
    targets.every((target) => lookup(target, name) === scopes.program.bindings.get(name));

  let callee: string;
  if (existing && isUnshadowed(existing.local.name)) {
    callee = existing.local.name;
  } else if (namespace && isUnshadowed(namespace.local.name)) {
    callee = `${namespace.local.name}.mocked`;
  } else {
    const name = targets.some((target) => lookup(target, 'mocked'))
      ? generateUid(scopes, 'mocked')
      : 'mocked';
    callee = name;
    const specifier = name === 'mocked' ? 'mocked' : `mocked as ${name}`;
    const namedImport = testImports.find((node) =>
      node.specifiers.every((s) => s.type !== 'ImportNamespaceSpecifier')
    );
    if (namedImport) {
      setImportSpecifiers(editor, namedImport, namedImport.specifiers, { named: [specifier] });
    } else {
      const lastImport = program.body.findLast((node) => node.type === 'ImportDeclaration');
      const declaration = `import { ${specifier} } from ${editor.quote}storybook/test${editor.quote};`;
      if (lastImport) {
        editor.edits.appendLeft(lastImport.end, `\n${declaration}`);
      } else {
        editor.edits.prepend(`${declaration}\n`);
      }
    }
  }

  for (const target of targets) {
    editor.edits.appendRight(target.start, `${callee}(`);
    editor.edits.appendLeft(target.end, ')');
  }
}
