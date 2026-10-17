import type { ConfigFile } from './ConfigFile.ts';
import {
  type CsfMutationDiagnostic,
  type CsfObject,
  type CsfObjectHost,
  type MemberInsert,
  type ObjectRoot,
  createCsfObject,
  literalRoot,
} from './CsfObject.ts';
import {
  type E,
  type Node,
  type Property,
  isIdentifier,
  isStringLiteral,
  locationOf,
  outerSpan,
  staticKey,
  walk,
} from './estree/ast.ts';
import {
  type List,
  type SourceEditor,
  appendStatement,
  declaratorList,
  printKey,
  printString,
  removeFromList,
  removeStatement,
  specifierList,
} from './estree/editor.ts';
import { generateUid } from './estree/scope.ts';
import { placeableValueSource } from './estree/values.ts';

type Span = { start: number; end: number };

const isConfigFactory = (editor: SourceEditor, callee: Node): boolean => {
  if (callee.type !== 'Identifier') {
    return false;
  }
  const binding = editor.scopes.bindingOf(callee);
  const name =
    binding?.node.type === 'ImportSpecifier'
      ? binding.node.imported
      : !binding
        ? callee
        : undefined;
  return (
    name?.type === 'Identifier' &&
    ['defineMain', 'definePreview', 'defineConfig'].includes(name.name)
  );
};

const isModuleExports = (node: Node) =>
  node.type === 'MemberExpression' &&
  isIdentifier(node.object, 'module') &&
  (isIdentifier(node.property, 'exports') || isStringLiteral(node.property)) &&
  (node.property.type === 'Identifier' || (node.property as E.StringLiteral).value === 'exports');

const TS_WRAPPERS = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression']);

const isValidIdentifier = (name: string) => /^[A-Za-z_$][\w$]*$/.test(name);

// `custom-field` → `customField`
const toIdentifier = (name: string) =>
  name
    .replace(/[^\w$]+(.)?/g, (_, next: string | undefined) => (next ? next.toUpperCase() : ''))
    .replace(/^\d/, '_$&') || '_';

type NamedEntry = {
  name: string;
  declaration: E.VariableDeclarator | E.Function;
  // The `const`/`let` statement owning a declarator, or the function itself.
  statement: Node;
  exportStatement?: E.ExportNamedDeclaration;
  specifier?: { statement: E.ExportNamedDeclaration; specifier: E.ExportSpecifier };
};

type Rejection = { ok: false; diagnostic: CsfMutationDiagnostic };

export const locateConfigRoot = (
  config: ConfigFile,
  mode: 'read' | 'mutate'
): { ok: true; root: ObjectRoot } | Rejection => {
  const editor = config._editor;
  const { program } = editor;
  const reject = (
    node: Node | Span | undefined,
    code: CsfMutationDiagnostic['code'],
    message: string
  ): Rejection => ({
    ok: false,
    diagnostic: {
      code,
      target: { kind: 'config' },
      path: [],
      message,
      ...(node && node !== program
        ? { loc: locationOf(editor.code, (node as Span).start, (node as Span).end) }
        : {}),
    },
  });

  const parents = new Map<Node, Node | null>();
  const assignments: E.AssignmentExpression[] = [];
  walk(program, (node, parent) => {
    parents.set(node, parent);
    if (
      node.type === 'AssignmentExpression' &&
      node.left.type === 'MemberExpression' &&
      (isModuleExports(node.left) || isIdentifier(node.left.object, 'exports'))
    ) {
      assignments.push(node);
    }
  });
  const ancestors = (node: Node) => {
    const result: Node[] = [];
    for (let parent = parents.get(node); parent; parent = parents.get(parent)) {
      result.push(parent);
    }
    return result;
  };
  const isStatement = (node: Node) =>
    node.type.endsWith('Statement') || node.type.endsWith('Declaration');

  const isExportReference = (reference: Node): boolean => {
    if (
      reference.type === 'ExportNamedDeclaration' ||
      reference.type === 'ExportDefaultDeclaration'
    ) {
      return true;
    }
    let parent = parents.get(reference);
    while (parent && TS_WRAPPERS.has(parent.type)) {
      parent = parents.get(parent);
    }
    return (
      parent?.type === 'ExportDefaultDeclaration' ||
      parent?.type === 'ExportSpecifier' ||
      (parent?.type === 'AssignmentExpression' && isModuleExports(parent.left))
    );
  };

  const root = config._exportsObject;
  if (root) {
    const chain = ancestors(root);
    const declaration = chain.find(
      (node): node is E.VariableDeclarator => node.type === 'VariableDeclarator'
    );
    if (
      mode === 'mutate' &&
      Object.values(config._exportDecls).some((exported) => exported !== declaration)
    ) {
      return reject(
        root,
        'ambiguous-binding',
        'Cannot mutate mixed default and named config exports'
      );
    }
    for (const parent of chain) {
      if (parent.type !== 'CallExpression') {
        continue;
      }
      const { callee } = parent;
      const typeChain =
        callee.type === 'MemberExpression' &&
        !callee.computed &&
        isIdentifier(callee.property, 'type') &&
        parent.arguments.length === 0;
      if (!typeChain && !(isConfigFactory(editor, callee) && parent.arguments.length === 1)) {
        return reject(
          parent,
          'unsupported-initializer',
          'Cannot mutate an arbitrary config factory call'
        );
      }
    }
    const statementIndex = chain.findIndex(isStatement);
    const statement = chain[statementIndex];
    if (
      statement?.type === 'ExpressionStatement' &&
      (statement.expression.type !== 'AssignmentExpression' ||
        !isModuleExports(statement.expression.left) ||
        statement.expression.left.type !== 'MemberExpression' ||
        statement.expression.left.property.type !== 'Identifier')
    ) {
      return reject(
        root,
        'ambiguous-binding',
        'Cannot mutate a config that is not directly exported'
      );
    }
    const statementParent = chain[statementIndex + 1];
    if (statementParent?.type !== 'Program' && statementParent?.type !== 'ExportNamedDeclaration') {
      return reject(
        root,
        'unsupported-initializer',
        'Cannot mutate a config declared inside a function or conditional'
      );
    }
    if (declaration?.id.type === 'Identifier') {
      const binding = editor.scopes.bindingOf(declaration.id);
      if (
        !binding?.constant ||
        binding.references.length !== 1 ||
        !binding.references.every(isExportReference)
      ) {
        return reject(
          declaration,
          'ambiguous-binding',
          'Cannot mutate a shared or reassigned config binding'
        );
      }
    }
    if (
      assignments.length > 1 ||
      assignments.some((assignment) => {
        const [statementNode, statementParentNode] = ancestors(assignment);
        return (
          editor.scopes.program.bindings.has('module') ||
          (assignment.left.type === 'MemberExpression' && assignment.left.computed) ||
          statementNode?.type !== 'ExpressionStatement' ||
          statementParentNode?.type !== 'Program'
        );
      })
    ) {
      return reject(
        root,
        'ambiguous-binding',
        'Cannot mutate conditional, repeated, or shadowed module.exports'
      );
    }
    return { ok: true, root: literalRoot(editor, root) };
  }

  if (config.hasDefaultExport || assignments.length > 0) {
    return reject(
      program,
      'unsupported-initializer',
      'Cannot mutate a config without a static object initializer'
    );
  }

  for (const statement of program.body) {
    if (statement.type === 'ExportNamedDeclaration' && statement.exportKind === 'type') {
      continue;
    }
    if (
      statement.type === 'ExportAllDeclaration' ||
      (statement.type === 'ExportNamedDeclaration' && statement.source)
    ) {
      return reject(
        statement,
        'unsupported-initializer',
        'Cannot mutate re-exported config fields'
      );
    }
    if (statement.type === 'ExportNamedDeclaration') {
      for (const specifier of statement.specifiers) {
        if (specifier.exportKind === 'type') {
          continue;
        }
        const name = exportedName(specifier.exported);
        if (!Object.hasOwn(config._exportDecls, name)) {
          return reject(
            specifier,
            'unsupported-initializer',
            `Cannot mutate the unresolved ${name} export`
          );
        }
      }
    }
  }

  const entries: NamedEntry[] = [];
  const seen = new Set<Node>();
  for (const [name, declaration] of Object.entries(config._exportDecls)) {
    if (declaration.id?.type !== 'Identifier') {
      return reject(
        declaration,
        'unsupported-initializer',
        `Cannot mutate the ${name} export without an expression initializer`
      );
    }
    const binding = editor.scopes.bindingOf(declaration.id);
    if (
      !binding?.constant ||
      seen.has(declaration) ||
      (mode === 'mutate' && !binding.references.every(isExportReference))
    ) {
      return reject(
        declaration,
        'ambiguous-binding',
        `Cannot mutate the shared or reassigned ${name} export`
      );
    }
    seen.add(declaration);
    if (declaration.type === 'VariableDeclarator' && !declaration.init) {
      return reject(
        declaration,
        'unsupported-initializer',
        `Cannot mutate the ${name} export without an expression initializer`
      );
    }
    const reference = binding.references.find(
      (candidate) => parents.get(candidate)?.type === 'ExportSpecifier'
    );
    const specifier = reference && (parents.get(reference) as E.ExportSpecifier);
    const owner = parents.get(declaration)!;
    const exportStatement = [owner, parents.get(owner)].find(
      (node): node is E.ExportNamedDeclaration => node?.type === 'ExportNamedDeclaration'
    );
    entries.push({
      name,
      declaration,
      statement: declaration.type === 'VariableDeclarator' ? owner : declaration,
      exportStatement,
      specifier: specifier
        ? { specifier, statement: parents.get(specifier) as E.ExportNamedDeclaration }
        : undefined,
    });
  }

  return { ok: true, root: namedExportsRoot(editor, entries) };
};

const exportedName = (node: E.ModuleExportName) =>
  node.type === 'Identifier' ? node.name : (node as E.StringLiteral).value;

// A config made of named exports, edited as if it were one object literal. Each member's key is the
// node that carries the exported name and its value the declaration's initializer, so every span a
// shared helper could read is a real one; the member itself only exists in memory.
const namedExportsRoot = (editor: SourceEditor, entries: NamedEntry[]): ObjectRoot => {
  const quote = editor.quote;
  const byProperty = new Map<Property, NamedEntry>();
  const properties = entries.map((entry) => {
    const value = (
      entry.declaration.type === 'VariableDeclarator' ? entry.declaration.init : entry.declaration
    ) as E.Expression;
    const key = entry.specifier ? entry.specifier.specifier.exported : entry.declaration.id!;
    const property = {
      type: 'Property',
      kind: 'init',
      method: false,
      shorthand: false,
      computed: false,
      key,
      value,
      start: entry.declaration.start,
      end: entry.declaration.end,
    } as unknown as Property;
    byProperty.set(property, entry);
    return property;
  });

  const declare = (members: MemberInsert[]) => {
    const names = editor.scopes.names;
    for (const { key, value } of members) {
      if (isValidIdentifier(key) && !editor.scopes.program.bindings.has(key) && !names.has(key)) {
        names.add(key);
        appendStatement(editor, `export const ${key} = ${value};`);
      } else {
        const id = generateUid(editor.scopes, toIdentifier(key));
        const exported = isValidIdentifier(key) ? key : printString(key, quote);
        appendStatement(editor, `const ${id} = ${value};\nexport { ${id} as ${exported} };`);
      }
    }
  };

  const removalOf = ({ specifier, statement, exportStatement, declaration }: NamedEntry) =>
    specifier
      ? {
          statement: specifier.statement,
          list: specifierList(editor, specifier.statement),
          item: specifier.specifier,
        }
      : {
          statement: exportStatement ?? statement,
          list:
            statement.type === 'VariableDeclaration'
              ? declaratorList(editor, statement)
              : undefined,
          item: declaration,
        };

  // One statement at a time: list edits made for each of its entries separately would overlap.
  const removeEntries = (removed: readonly NamedEntry[]) => {
    const byStatement = new Map<Node, { list?: List; items: Span[] }>();
    for (const entry of removed) {
      const { statement, list, item } = removalOf(entry);
      const group = byStatement.get(statement) ?? { list, items: [] };
      group.items.push(item);
      byStatement.set(statement, group);
    }
    for (const [statement, { list, items }] of byStatement) {
      if (list && items.length < list.items.length) {
        removeFromList(editor, list, items);
      } else {
        removeStatement(editor, statement);
      }
    }
  };

  const entryOf = (member: Property) => {
    const entry = byProperty.get(member);
    if (!entry) {
      throw new Error('CsfObject: unknown named export member');
    }
    return entry;
  };

  return {
    properties,
    detached: true,
    append: declare,
    prepend: declare,
    remove: (members) => removeEntries(members.map(entryOf)),
    replaceValue: (member, text) => {
      const { declaration } = entryOf(member);
      if (declaration.type === 'VariableDeclarator') {
        const value = outerSpan(declaration.init!);
        editor.edits.overwrite(value.start, value.end, text);
        return;
      }
      const id = declaration.id!.name;
      const fn = /^(async\s+)?function\s*(\*)?\s*([\w$]*)\s*(?=[(<])/.exec(text);
      if (fn && (!fn[3] || fn[3] === id)) {
        // Keep `export function name() {}` when the replacement is a compatible function.
        const prefix = `${fn[1] ? 'async ' : ''}function${fn[2] ? '*' : ''} ${id}`;
        editor.edits.overwrite(
          declaration.start,
          declaration.end,
          prefix + text.slice(fn[0].length)
        );
        return;
      }
      editor.edits.overwrite(declaration.start, declaration.end, `const ${id} = ${text};`);
    },
    rename: (member, key) => {
      const entry = entryOf(member);
      const name = key;
      if (entry.specifier) {
        const { local, exported } = entry.specifier.specifier;
        const printed = isValidIdentifier(name) ? name : printString(name, quote);
        // In `export { a }` the exported name is the local one, which has to stay.
        editor.edits.overwrite(
          exported.start,
          exported.end,
          exported.start === local.start ? `${editor.source(local)} as ${printed}` : printed
        );
        return;
      }
      const id = entry.declaration.id as E.BindingIdentifier;
      if (
        isValidIdentifier(name) &&
        (id.name === name || !editor.scopes.program.bindings.has(name))
      ) {
        editor.edits.overwrite(id.start, id.end, name);
        return;
      }
      removeEntries([entry]);
      declare([{ key: name, value: placeableValueSource(editor, member), text: '' }]);
    },
    group: (members, key) => {
      removeEntries(members.map(entryOf));
      const inner = members
        .map(
          (member) =>
            `${printKey(entryOf(member).name, quote)}: ${placeableValueSource(editor, member)}`
        )
        .join(', ');
      declare([{ key, value: `{ ${inner} }`, text: '' }]);
    },
    take: (member, key) => {
      const value = placeableValueSource(editor, member);
      return { key, value, text: `${printKey(key, quote)}: ${value}` };
    },
  };
};

export function createConfigObject(
  config: ConfigFile,
  mode: 'read' | 'mutate',
  report: (diagnostic: CsfMutationDiagnostic) => void,
  markChanged: () => void
): { ok: true; object: CsfObject } | { ok: false; diagnostic: CsfMutationDiagnostic } {
  const located = locateConfigRoot(config, mode);
  if (located.ok === false) {
    return located;
  }
  const host: CsfObjectHost = {
    editor: config._editor,
    root: () => {
      const current = locateConfigRoot(config, mode);
      return current.ok ? current.root : undefined;
    },
  };
  return { ok: true, object: createCsfObject({ kind: 'config' }, host, [], report, markChanged) };
}

export { staticKey };
