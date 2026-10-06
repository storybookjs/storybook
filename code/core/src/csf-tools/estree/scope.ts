import { type E, type Node, children, isNode } from './ast.ts';

export type BindingKind =
  | 'var'
  | 'let'
  | 'const'
  | 'function'
  | 'class'
  | 'import'
  | 'param'
  | 'other';

export interface Binding {
  name: string;
  kind: BindingKind;
  // VariableDeclarator, FunctionDeclaration, ClassDeclaration, import specifier, or the pattern.
  node: Node;
  // VariableDeclaration or ImportDeclaration that owns `node`, when there is one.
  declaration?: Node;
  identifier: E.BindingIdentifier;
  scope: Scope;
  // False when the binding is declared twice or written after its declaration.
  constant: boolean;
  references: Node[];
}

export class Scope {
  readonly bindings = new Map<string, Binding>();

  readonly node: Node;

  readonly parent: Scope | null;

  readonly isFunctionScope: boolean;

  constructor(node: Node, parent: Scope | null, isFunctionScope: boolean) {
    this.node = node;
    this.parent = parent;
    this.isFunctionScope = isFunctionScope;
  }

  lookup(name: string): Binding | undefined {
    return this.bindings.get(name) ?? this.parent?.lookup(name);
  }

  get functionScope(): Scope {
    return this.isFunctionScope || !this.parent ? this : this.parent.functionScope;
  }
}

export interface ScopeInfo {
  program: Scope;
  bindingOf(identifier: Node): Binding | undefined;
  scopeOf(node: Node): Scope;
  // Every identifier name in the file, used to generate collision-free names.
  names: Set<string>;
  // Names the file reads without declaring them: globals and anything another scope provides.
  unbound: Set<string>;
}

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

const LOOP_TYPES = new Set([
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
]);

const BLOCK_SCOPE_TYPES = new Set([
  'TSModuleBlock',
  'BlockStatement',
  'StaticBlock',
  'SwitchStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'CatchClause',
  'ClassExpression',
  'ClassDeclaration',
]);

// TS wrappers that hold a runtime expression; every other `TS*` node is type-only.
const TS_EXPRESSIONS = new Set([
  'TSModuleDeclaration',
  'TSModuleBlock',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
  'TSExportAssignment',
  'TSParameterProperty',
  'TSEnumDeclaration',
  'TSEnumBody',
  'TSEnumMember',
]);

const TYPE_KEYS = new Set([
  'typeAnnotation',
  'returnType',
  'typeParameters',
  'typeArguments',
  'superTypeArguments',
  'implements',
]);

const isCompatTag = (name: string) => /^[a-z]/.test(name) || name.includes('-');

// Identifiers a binding pattern declares, plus the expressions nested in it (defaults, keys).
const patternParts = (pattern: Node, ids: E.BindingIdentifier[], expressions: Node[]) => {
  const annotation = (pattern as { typeAnnotation?: Node | null }).typeAnnotation;
  if (annotation) {
    expressions.push(annotation);
  }
  switch (pattern.type) {
    case 'Identifier':
      ids.push(pattern as E.BindingIdentifier);
      return;
    case 'ObjectPattern':
      for (const property of pattern.properties) {
        if (property.type === 'RestElement') {
          patternParts(property.argument, ids, expressions);
        } else {
          if (property.computed) {
            expressions.push(property.key);
          }
          patternParts(property.value, ids, expressions);
        }
      }
      return;
    case 'ArrayPattern':
      for (const element of pattern.elements) {
        if (element) {
          patternParts(element, ids, expressions);
        }
      }
      return;
    case 'RestElement':
      patternParts(pattern.argument, ids, expressions);
      return;
    case 'AssignmentPattern':
      patternParts(pattern.left, ids, expressions);
      expressions.push(pattern.right);
      return;
    case 'TSParameterProperty':
      patternParts(pattern.parameter, ids, expressions);
      return;
    default:
      // Member expressions in assignment patterns (`[a.b] = c`) are expressions, not declarations.
      expressions.push(pattern);
  }
};

const declarationStatements = (node: Node): Node[] => {
  switch (node.type) {
    case 'Program':
    case 'BlockStatement':
    case 'StaticBlock':
    case 'TSModuleBlock':
      return node.body as Node[];
    case 'SwitchStatement':
      return node.cases.flatMap((switchCase) => switchCase.consequent);
    default:
      return [];
  }
};

export const analyzeScopes = (program: E.Program): ScopeInfo => {
  const identifierBindings = new Map<Node, Binding>();
  const nodeScopes = new Map<Node, Scope>();
  const names = new Set<string>();
  const violations: { scope: Scope; identifier: E.IdentifierReference }[] = [];
  const references: { scope: Scope; identifier: Node; name: string }[] = [];

  const declare = (
    scope: Scope,
    identifier: E.BindingIdentifier,
    kind: BindingKind,
    node: Node,
    declaration?: Node
  ) => {
    names.add(identifier.name);
    const existing = scope.bindings.get(identifier.name);
    if (existing) {
      existing.constant = false;
      identifierBindings.set(identifier, existing);
      return;
    }
    const binding: Binding = {
      name: identifier.name,
      kind,
      node,
      declaration,
      identifier,
      scope,
      constant: true,
      references: [],
    };
    scope.bindings.set(identifier.name, binding);
    identifierBindings.set(identifier, binding);
  };

  const declareVariable = (scope: Scope, declaration: E.VariableDeclaration) => {
    const kind: BindingKind =
      declaration.kind === 'var' ? 'var' : declaration.kind === 'const' ? 'const' : 'let';
    for (const declarator of declaration.declarations) {
      const ids: E.BindingIdentifier[] = [];
      patternParts(declarator.id, ids, []);
      for (const id of ids) {
        declare(scope, id, kind, declarator, declaration);
      }
    }
  };

  // Hoists `var` declarations to the enclosing function scope without crossing functions.
  const hoistVars = (scope: Scope, node: Node) => {
    for (const child of children(node)) {
      if (
        FUNCTION_TYPES.has(child.type) ||
        child.type.startsWith('TS') ||
        child.type.startsWith('Class') ||
        child.type.endsWith('Expression')
      ) {
        continue;
      }
      if (child.type === 'VariableDeclaration' && child.kind === 'var') {
        declareVariable(scope, child);
      }
      hoistVars(scope, child);
    }
  };

  const declareLexical = (scope: Scope, node: Node) => {
    for (const statement of declarationStatements(node)) {
      const declaration =
        (statement.type === 'ExportNamedDeclaration' ||
          statement.type === 'ExportDefaultDeclaration') &&
        statement.declaration
          ? (statement.declaration as Node)
          : statement;
      if (declaration.type === 'VariableDeclaration' && declaration.kind !== 'var') {
        declareVariable(scope, declaration);
      } else if (
        (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') &&
        declaration.id
      ) {
        declare(
          scope,
          declaration.id,
          declaration.type === 'FunctionDeclaration' ? 'function' : 'class',
          declaration
        );
      } else if (declaration.type === 'ImportDeclaration') {
        for (const specifier of declaration.specifiers) {
          declare(scope, specifier.local, 'import', specifier, declaration);
        }
      } else if (declaration.type === 'TSImportEqualsDeclaration') {
        declare(scope, declaration.id, 'import', declaration);
      }
    }
  };

  const enterScope = (node: Node, parent: Scope | null): Scope => {
    const isFunction = FUNCTION_TYPES.has(node.type);
    const scope = new Scope(node, parent, isFunction);
    nodeScopes.set(node, scope);
    if (isFunction) {
      const fn = node as E.Function | E.ArrowFunctionExpression;
      if (fn.type === 'FunctionExpression' && fn.id) {
        declare(scope, fn.id, 'function', fn);
      }
      for (const param of fn.params) {
        const ids: E.BindingIdentifier[] = [];
        patternParts(param, ids, []);
        for (const id of ids) {
          declare(scope, id, 'param', param);
        }
      }
      if (fn.body?.type === 'BlockStatement') {
        hoistVars(scope, fn.body);
        declareLexical(scope, fn.body);
      }
    } else if (node.type === 'ClassExpression' && node.id) {
      declare(scope, node.id, 'class', node);
    } else if (node.type === 'CatchClause' && node.param) {
      const ids: E.BindingIdentifier[] = [];
      patternParts(node.param, ids, []);
      for (const id of ids) {
        declare(scope, id, 'param', node.param);
      }
    } else if (
      (node.type === 'ForStatement' && node.init?.type === 'VariableDeclaration') ||
      ((node.type === 'ForInStatement' || node.type === 'ForOfStatement') &&
        node.left.type === 'VariableDeclaration')
    ) {
      const declaration = (
        node.type === 'ForStatement' ? node.init : node.left
      ) as E.VariableDeclaration;
      if (declaration.kind !== 'var') {
        declareVariable(scope, declaration);
      }
    } else {
      if (node.type === 'TSModuleBlock') {
        hoistVars(scope, node);
      }
      declareLexical(scope, node);
      if (loopDepth > 0) {
        // A function declared in a loop body is declared again on every iteration.
        for (const binding of scope.bindings.values()) {
          if (binding.kind === 'function') {
            binding.constant = false;
          }
        }
      }
    }
    return scope;
  };

  const markWrites = (target: Node, scope: Scope) => {
    const ids: E.BindingIdentifier[] = [];
    const expressions: Node[] = [];
    patternParts(target, ids, expressions);
    for (const id of ids) {
      names.add(id.name);
      violations.push({ scope, identifier: id as unknown as E.IdentifierReference });
    }
    for (const expression of expressions) {
      visit(expression, scope);
    }
  };

  const visitPattern = (pattern: Node, scope: Scope) => {
    const expressions: Node[] = [];
    patternParts(pattern, [], expressions);
    for (const expression of expressions) {
      visit(expression, scope);
    }
  };

  const visitChildren = (node: Node, scope: Scope, skip?: Set<string>) => {
    for (const child of childEntries(node)) {
      if (skip?.has(child.key)) {
        continue;
      }
      visit(child.node, scope);
    }
  };

  const reference = (node: Node | null | undefined, scope: Scope) => {
    let target = node;
    while (target?.type === 'TSQualifiedName' || target?.type === 'MemberExpression') {
      target = target.type === 'TSQualifiedName' ? target.left : target.object;
    }
    if (target?.type === 'Identifier') {
      names.add(target.name);
      references.push({ scope, identifier: target, name: target.name });
    }
  };

  // Babel counts the names a type refers to (`satisfies Meta<typeof Button>`) as references,
  // except inside `: Type` annotations.
  const visitType = (node: Node, scope: Scope): void => {
    switch (node.type) {
      case 'TSTypeAnnotation':
        return;
      case 'TSTypeReference':
        reference(node.typeName, scope);
        break;
      case 'TSTypeQuery':
        reference(node.exprName, scope);
        break;
      case 'TSClassImplements':
      case 'TSInterfaceHeritage':
        reference(node.expression, scope);
        break;
      case 'TSImportType':
        reference(node.qualifier, scope);
        break;
      case 'TSPropertySignature':
        if (node.computed) {
          reference(node.key, scope);
        }
        break;
      case 'TSMethodSignature':
        // Babel also counts a method signature's name and its parameter names.
        reference(node.key, scope);
        node.params.forEach((param) => reference(param, scope));
        break;
      case 'TSFunctionType':
      case 'TSConstructorType':
      case 'TSCallSignatureDeclaration':
      case 'TSConstructSignatureDeclaration':
        node.params.forEach((param) => reference(param, scope));
        break;
    }
    for (const child of childEntries(node)) {
      if (child.node.type.startsWith('TS') || TYPE_KEYS.has(child.key)) {
        visitType(child.node, scope);
      } else if (child.node.type !== 'Identifier') {
        visitType(child.node, scope);
      }
    }
  };

  let loopDepth = 0;

  const visit = (node: Node, scope: Scope): void => {
    const savedLoopDepth = loopDepth;
    loopDepth = FUNCTION_TYPES.has(node.type) ? 0 : loopDepth + (LOOP_TYPES.has(node.type) ? 1 : 0);
    try {
      visitNode(node, scope);
    } finally {
      loopDepth = savedLoopDepth;
    }
  };

  const visitNode = (node: Node, scope: Scope): void => {
    if (node.type.startsWith('TS') && !TS_EXPRESSIONS.has(node.type)) {
      visitType(node, scope);
      return;
    }
    for (const key of TYPE_KEYS) {
      const value = (node as unknown as Record<string, unknown>)[key];
      for (const item of Array.isArray(value) ? value : [value]) {
        if (isNode(item)) {
          visitType(item, scope);
        }
      }
    }
    let current = scope;
    if (node !== program && (FUNCTION_TYPES.has(node.type) || BLOCK_SCOPE_TYPES.has(node.type))) {
      // A function body block shares the function's scope.
      if (!(node.type === 'BlockStatement' && nodeScopes.get(node))) {
        current = enterScope(node, scope);
      }
    }

    switch (node.type) {
      case 'Identifier':
        names.add(node.name);
        references.push({ scope: current, identifier: node, name: node.name });
        return;
      case 'JSXIdentifier':
        if (!isCompatTag(node.name)) {
          names.add(node.name);
          references.push({ scope: current, identifier: node, name: node.name });
        }
        return;
      case 'JSXMemberExpression':
        if (node.object.type === 'JSXIdentifier') {
          names.add(node.object.name);
          references.push({ scope: current, identifier: node.object, name: node.object.name });
        } else {
          visit(node.object, current);
        }
        return;
      case 'MetaProperty':
        return;
      case 'JSXAttribute':
        if (node.value) {
          visit(node.value, current);
        }
        return;
      case 'MemberExpression':
        visit(node.object, current);
        if (node.computed) {
          visit(node.property, current);
        } else if (node.property.type === 'Identifier') {
          names.add(node.property.name);
        }
        return;
      case 'Property':
        if (node.computed) {
          visit(node.key, current);
        } else if (node.key.type === 'Identifier') {
          names.add(node.key.name);
        }
        visit(node.value, current);
        return;
      case 'MethodDefinition':
      case 'PropertyDefinition':
      case 'AccessorProperty':
        for (const decorator of node.decorators ?? []) {
          visit(decorator, current);
        }
        if (node.computed) {
          visit(node.key, current);
        }
        if (node.value) {
          visit(node.value, current);
        }
        return;
      case 'LabeledStatement':
        visit(node.body, current);
        return;
      case 'BreakStatement':
      case 'ContinueStatement':
        return;
      case 'ImportDeclaration':
        for (const specifier of node.specifiers) {
          names.add(specifier.local.name);
        }
        return;
      case 'ExportNamedDeclaration':
        if (node.declaration) {
          visit(node.declaration, current);
        } else if (!node.source) {
          for (const specifier of node.specifiers) {
            if (specifier.local.type === 'Identifier') {
              visit(specifier.local, current);
            }
          }
        }
        return;
      case 'ExportAllDeclaration':
        return;
      case 'VariableDeclarator':
        visitPattern(node.id, current);
        if (node.init) {
          visit(node.init, current);
        }
        return;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        for (const param of node.params) {
          visitPattern(param, current);
        }
        if (node.body) {
          if (node.body.type === 'BlockStatement') {
            nodeScopes.set(node.body, current);
            for (const statement of node.body.body) {
              visit(statement, current);
            }
          } else {
            visit(node.body, current);
          }
        }
        return;
      case 'ClassDeclaration':
      case 'ClassExpression':
        for (const decorator of node.decorators ?? []) {
          visit(decorator, current);
        }
        if (node.superClass) {
          visit(node.superClass, current);
        }
        visit(node.body, current);
        return;
      case 'CatchClause':
        if (node.param) {
          visitPattern(node.param, current);
        }
        visit(node.body, current);
        return;
      case 'AssignmentExpression':
        if (node.left.type === 'Identifier' || node.left.type.endsWith('Pattern')) {
          markWrites(node.left, current);
        } else {
          visit(node.left, current);
        }
        visit(node.right, current);
        return;
      case 'UpdateExpression':
        if (node.argument.type === 'Identifier') {
          // `x++` both reads and writes `x`.
          references.push({ scope: current, identifier: node.argument, name: node.argument.name });
          markWrites(node.argument, current);
        } else {
          visit(node.argument, current);
        }
        return;
      case 'ForInStatement':
      case 'ForOfStatement':
        if (node.left.type === 'VariableDeclaration') {
          visit(node.left, current);
        } else {
          markWrites(node.left, current);
        }
        visit(node.right, current);
        visit(node.body, current);
        return;
      case 'TSParameterProperty':
        visitPattern(node.parameter, current);
        return;
      case 'TSEnumDeclaration':
        visit(node.body, current);
        return;
      case 'TSModuleDeclaration':
        if (node.body) {
          visit(node.body, current);
        }
        return;
      case 'TSEnumMember':
        if (node.initializer) {
          visit(node.initializer, current);
        }
        return;
      default:
        visitChildren(node, current, TYPE_KEYS);
    }
  };

  const declaredProgramScope = enterScope(program, null);
  hoistVars(declaredProgramScope, program);
  for (const statement of program.body) {
    visit(statement as Node, declaredProgramScope);
  }

  const unbound = new Set<string>();
  for (const { scope, identifier, name } of references) {
    const binding = scope.lookup(name);
    if (binding) {
      binding.references.push(identifier);
      identifierBindings.set(identifier, binding);
    } else if (identifier.type !== 'ExportNamedDeclaration') {
      unbound.add(name);
    }
  }
  // Overload signatures count as references to the function they overload.
  for (const statement of program.body) {
    if (statement.type === 'TSDeclareFunction' && statement.id) {
      declaredProgramScope.bindings.get(statement.id.name)?.references.push(statement);
    }
  }

  // Like Babel, an `export` of a declaration counts as a reference to the bindings it declares.
  for (const statement of program.body) {
    if (
      (statement.type !== 'ExportNamedDeclaration' &&
        statement.type !== 'ExportDefaultDeclaration') ||
      !statement.declaration
    ) {
      continue;
    }
    const declaration = statement.declaration as Node;
    const ids: E.BindingIdentifier[] = [];
    if (declaration.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        patternParts(declarator.id, ids, []);
      }
    } else if ((declaration as { id?: Node | null }).id?.type === 'Identifier') {
      // Functions, classes and TS declarations: an exported `type X` also references a value `X`.
      ids.push((declaration as { id: E.BindingIdentifier }).id);
    }
    for (const id of ids) {
      declaredProgramScope.bindings.get(id.name)?.references.push(statement);
    }
  }
  for (const { scope, identifier } of violations) {
    const binding = scope.lookup(identifier.name);
    if (binding) {
      binding.constant = false;
      identifierBindings.set(identifier, binding);
    }
  }

  return {
    program: declaredProgramScope,
    names,
    unbound,
    bindingOf: (identifier) => identifierBindings.get(identifier),
    scopeOf: (node) => {
      // Linear over scopes; only write paths ask.
      let best = declaredProgramScope;
      for (const [scopeNode, scope] of nodeScopes) {
        const span = scopeNode as Node & { start: number; end: number };
        const target = node as Node & { start: number; end: number };
        if (
          span.start <= target.start &&
          target.end <= span.end &&
          span.end - span.start <
            (best.node as Node & { start: number; end: number }).end -
              (best.node as Node & { start: number; end: number }).start
        ) {
          best = scope;
        }
      }
      return best;
    },
  };
};

const childEntries = (node: Node): { key: string; node: Node }[] => {
  const result: { key: string; node: Node }[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) {
          result.push({ key, node: item });
        }
      }
    } else if (isNode(value)) {
      result.push({ key, node: value });
    }
  }
  return result;
};

// Babel-compatible unique name: `_meta`, `_meta2`, `_meta3`, …
export const generateUid = (info: ScopeInfo, name: string) => {
  let uid = `_${name}`;
  for (let index = 2; info.names.has(uid); index++) {
    uid = `_${name}${index}`;
  }
  info.names.add(uid);
  return uid;
};
