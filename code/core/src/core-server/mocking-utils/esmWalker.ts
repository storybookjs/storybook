// TODO: Remove as soon as https://github.com/vitest-dev/vitest/pull/8301 is released and we use it

/**
 * Copyright (c) Vitest
 * https://github.com/vitest-dev/vitest/blob/v3.2.4/packages/mocker/src/node/esmWalker.ts MIT
 * License
 *
 * Copyright (c) 2021-Present Vitest Team
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 * associated documentation files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
 * NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import type {
  CallExpression,
  Function as FunctionNode,
  Identifier,
  ImportExpression,
  Literal,
  Pattern,
  Property,
  VariableDeclaration,
  Node as _Node,
} from 'estree';
import { walk as eswalk } from 'estree-walker';

export type * from 'estree';

export type Positioned<T> = T & {
  start: number;
  end: number;
};

export type Node = Positioned<_Node>;

interface IdentifierInfo {
  /** If the identifier is used in a property shorthand { foo } -> { foo: **import_x**.foo } */
  hasBindingShortcut: boolean;
  /** The identifier is used in a class declaration */
  classDeclaration: boolean;
  /** The identifier is a name for a class expression */
  classExpression: boolean;
}

interface Visitors {
  onIdentifier?: (node: Positioned<Identifier>, info: IdentifierInfo, parentStack: Node[]) => void;
  onImportMeta?: (node: Node) => void;
  onDynamicImport?: (node: Positioned<ImportExpression>) => void;
  onCallExpression?: (node: Positioned<CallExpression>) => void;
}

const isNodeInPatternWeakSet = new WeakSet<_Node>();
export function setIsNodeInPattern(node: Property): WeakSet<_Node> {
  return isNodeInPatternWeakSet.add(node);
}
export function isNodeInPattern(node: _Node): node is Property {
  return isNodeInPatternWeakSet.has(node);
}

/** Same logic from @vue/compiler-core & @vue/compiler-sfc Except this is using acorn AST */
export function esmWalker(
  root: Node,
  { onIdentifier, onImportMeta, onDynamicImport, onCallExpression }: Visitors
): void {
  const parentStack: Node[] = [];
  const varKindStack: VariableDeclaration['kind'][] = [];
  const scopeMap = new WeakMap<_Node, Set<string>>();
  const identifiers: [id: any, stack: Node[]][] = [];

  const setScope = (node: _Node, name: string) => {
    let scopeIds = scopeMap.get(node);
    if (scopeIds && scopeIds.has(name)) {
      return;
    }

    if (!scopeIds) {
      scopeIds = new Set();
      scopeMap.set(node, scopeIds);
    }
    scopeIds.add(name);
  };

  function isInScope(name: string, parents: Node[]) {
    return parents.some((node) => node && scopeMap.get(node)?.has(name));
  }
  function handlePattern(p: Pattern, parentScope: _Node) {
    if (p.type === 'Identifier') {
      setScope(parentScope, p.name);
    } else if (p.type === 'RestElement') {
      handlePattern(p.argument, parentScope);
    } else if (p.type === 'ObjectPattern') {
      p.properties.forEach((property) => {
        if (property.type === 'RestElement') {
          setScope(parentScope, (property.argument as Identifier).name);
        } else {
          handlePattern(property.value, parentScope);
        }
      });
    } else if (p.type === 'ArrayPattern') {
      p.elements.forEach((element) => {
        if (element) {
          handlePattern(element, parentScope);
        }
      });
    } else if (p.type === 'AssignmentPattern') {
      handlePattern(p.left, parentScope);
    } else {
      setScope(parentScope, (p as any).name);
    }
  }

  eswalk(root as Node, {
    enter(node, parent) {
      if (node.type === 'ImportDeclaration') {
        return this.skip();
      }

      // track parent stack, skip for "else-if"/"else" branches as acorn nests
      // the ast within "if" nodes instead of flattening them
      if (parent && !(parent.type === 'IfStatement' && node === parent.alternate)) {
        parentStack.unshift(parent as Node);
      }

      // track variable declaration kind stack used by VariableDeclarator
      if (node.type === 'VariableDeclaration') {
        varKindStack.unshift(node.kind);
      }

      if (node.type === 'CallExpression') {
        onCallExpression?.(node as Positioned<CallExpression>);
      }

      if (node.type === 'MetaProperty' && node.meta.name === 'import') {
        onImportMeta?.(node as Node);
      } else if (node.type === 'ImportExpression') {
        onDynamicImport?.(node as Positioned<ImportExpression>);
      }

      if (node.type === 'Identifier') {
        if (!isInScope(node.name, parentStack) && isRefIdentifier(node, parent!, parentStack)) {
          // record the identifier, for DFS -> BFS
          identifiers.push([node, parentStack.slice(0)]);
        }
      } else if (isFunctionNode(node)) {
        // If it is a function declaration, it could be shadowing an import
        // Add its name to the scope so it won't get replaced
        if (node.type === 'FunctionDeclaration') {
          const parentScope = findParentScope(parentStack);
          if (parentScope) {
            setScope(parentScope, node.id!.name);
          }
        }
        // walk function expressions and add its arguments to known identifiers
        // so that we don't prefix them
        node.params.forEach((p) => {
          if (p.type === 'ObjectPattern' || p.type === 'ArrayPattern') {
            handlePattern(p, node);
            return;
          }
          (eswalk as any)(p.type === 'AssignmentPattern' ? p.left : p, {
            enter(child: Node, parent: Node) {
              // skip params default value of destructure
              if (parent?.type === 'AssignmentPattern' && parent?.right === child) {
                return this.skip();
              }

              if (child.type !== 'Identifier') {
                return;
              }
              // do not record as scope variable if is a destructuring keyword
              if (isStaticPropertyKey(child, parent)) {
                return;
              }
              // do not record if this is a default value
              // assignment of a destructuring variable
              if (
                (parent?.type === 'TemplateLiteral' && parent?.expressions.includes(child)) ||
                (parent?.type === 'CallExpression' && parent?.callee === child)
              ) {
                return;
              }

              setScope(node, child.name);
            },
          });
        });
      } else if (node.type === 'Property' && parent!.type === 'ObjectPattern') {
        // mark property in destructuring pattern
        setIsNodeInPattern(node);
      } else if (node.type === 'VariableDeclarator') {
        const parentFunction = findParentScope(parentStack, varKindStack[0] === 'var');
        if (parentFunction) {
          handlePattern(node.id, parentFunction);
        }
      } else if (node.type === 'CatchClause' && node.param) {
        handlePattern(node.param, node);
      }
    },

    leave(node, parent) {
      // untrack parent stack from above
      if (parent && !(parent.type === 'IfStatement' && node === parent.alternate)) {
        parentStack.shift();
      }

      if (node.type === 'VariableDeclaration') {
        varKindStack.shift();
      }
    },
  });

  // emit the identifier events in BFS so the hoisted declarations
  // can be captured correctly
  identifiers.forEach(([node, stack]) => {
    if (!isInScope(node.name, stack)) {
      const parent = stack[0];
      const grandparent = stack[1];
      const hasBindingShortcut =
        isStaticProperty(parent) &&
        parent.shorthand &&
        (!isNodeInPattern(parent) || isInDestructuringAssignment(parent, parentStack));

      const classDeclaration =
        (parent.type === 'PropertyDefinition' && grandparent?.type === 'ClassBody') ||
        (parent.type === 'ClassDeclaration' && node === parent.superClass);

      const classExpression = parent.type === 'ClassExpression' && node === parent.id;

      onIdentifier?.(
        node,
        {
          hasBindingShortcut,
          classDeclaration,
          classExpression,
        },
        stack
      );
    }
  });
}

function isRefIdentifier(id: Identifier, parent: _Node, parentStack: _Node[]) {
  // declaration id
  if (
    parent.type === 'CatchClause' ||
    ((parent.type === 'VariableDeclarator' || parent.type === 'ClassDeclaration') &&
      parent.id === id)
  ) {
    return false;
  }

  if (isFunctionNode(parent)) {
    // function declaration/expression id
    if ((parent as any).id === id) {
      return false;
    }

    // params list
    if (parent.params.includes(id)) {
      return false;
    }
  }

  // class method name
  if (parent.type === 'MethodDefinition' && !parent.computed) {
    return false;
  }

  // property key
  if (isStaticPropertyKey(id, parent)) {
    return false;
  }

  // object destructuring pattern
  if (isNodeInPattern(parent) && parent.value === id) {
    return false;
  }

  // non-assignment array destructuring pattern
  if (parent.type === 'ArrayPattern' && !isInDestructuringAssignment(parent, parentStack)) {
    return false;
  }

  // member expression property
  if (parent.type === 'MemberExpression' && parent.property === id && !parent.computed) {
    return false;
  }

  if (parent.type === 'ExportSpecifier') {
    return false;
  }

  // is a special keyword but parsed as identifier
  if (id.name === 'arguments') {
    return false;
  }

  return true;
}

export function isStaticProperty(node: _Node): node is Property {
  return node && node.type === 'Property' && !node.computed;
}

export function isStaticPropertyKey(node: _Node, parent: _Node): boolean {
  return isStaticProperty(parent) && parent.key === node;
}

const functionNodeTypeRE = /Function(?:Expression|Declaration)$|Method$/;
export function isFunctionNode(node: _Node): node is FunctionNode {
  return functionNodeTypeRE.test(node.type);
}

const blockNodeTypeRE = /^BlockStatement$|^For(?:In|Of)?Statement$/;
function isBlock(node: _Node) {
  return blockNodeTypeRE.test(node.type);
}

function findParentScope(parentStack: _Node[], isVar = false): _Node | undefined {
  return parentStack.find(isVar ? isFunctionNode : isBlock);
}

export function isInDestructuringAssignment(parent: _Node, parentStack: _Node[]): boolean {
  if (parent && (parent.type === 'Property' || parent.type === 'ArrayPattern')) {
    return parentStack.some((i) => i.type === 'AssignmentExpression');
  }

  return false;
}

export function getArbitraryModuleIdentifier(node: Identifier | Literal): string {
  return node.type === 'Identifier' ? node.name : node.raw!;
}
