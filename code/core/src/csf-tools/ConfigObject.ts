import type { ConfigFile } from './ConfigFile.ts';
import {
  type CsfMutationDiagnostic,
  type CsfObject,
  type CsfObjectHost,
  type MemberInsert,
  type ObjectRoot,
  createCsfObject,
  literalRoot,
  valueSource,
} from './CsfObject.ts';
import {
  type E,
  type Node,
  type Property,
  isIdentifier,
  isStringLiteral,
  locationOf,
  staticKey,
  walk,
} from './estree/ast.ts';
import {
  type List,
  type SourceEditor,
  appendStatement,
  printKey,
  printString,
  removeFromList,
  removeStatement,
} from './estree/editor.ts';
import { generateUid } from './estree/scope.ts';

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

// `custom-field` → `customField`, the way Babel derives uid names.
const toIdentifier = (name: string) =>
  name
    .replace(/[^\w$]+(.)?/g, (_, next: string | undefined) => (next ? next.toUpperCase() : ''))
    .replace(/^\d/, '_$&') || '_';

type NamedEntry = {
  name: string;
  declaration: E.VariableDeclarator | E.Function;
  // The `const`/`let` statement owning a declarator, or the function itself.
  statement: Node;
  // `export const x` / `export function x` statement, when the declaration is exported directly.
  exportStatement?: E.ExportNamedDeclaration;
  specifier?: { statement: E.ExportNamedDeclaration; specifier: E.ExportSpecifier };
};

type Rejection = { ok: false; diagnostic: CsfMutationDiagnostic };

export const locateConfigRoot = (
  config: ConfigFile
): { ok: true; root: ObjectRoot } | Rejection => {
  const editor = config._editorSource;
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
    if (Object.values(config._exportDecls).some((exported) => exported !== declaration)) {
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
      !binding.references.every(isExportReference)
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

// A config made of named exports, edited as if it were one object literal.
const namedExportsRoot = (editor: SourceEditor, entries: NamedEntry[]): ObjectRoot => {
  const quote = editor.quote;
  const byProperty = new Map<Property, NamedEntry>();
  const properties = entries.map((entry) => {
    const value = (
      entry.declaration.type === 'VariableDeclarator' ? entry.declaration.init : entry.declaration
    ) as E.Expression;
    const property = {
      type: 'Property',
      kind: 'init',
      method: false,
      shorthand: false,
      computed: false,
      key: {
        type: 'Literal',
        value: entry.name,
        raw: printString(entry.name, quote),
        start: 0,
        end: 0,
      },
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

  const removeEntry = (entry: NamedEntry) => {
    if (entry.specifier) {
      const { statement, specifier } = entry.specifier;
      if (statement.specifiers.length === 1) {
        removeStatement(editor, statement);
      } else {
        removeFromList(editor, specifierList(editor, statement), [specifier]);
      }
      return;
    }
    if (entry.declaration.type === 'VariableDeclarator') {
      const statement = entry.statement as E.VariableDeclaration;
      if (statement.declarations.length > 1) {
        const list: List = {
          open: statement.start + statement.kind.length,
          close: statement.declarations.at(-1)!.end,
          items: statement.declarations,
        };
        removeFromList(editor, list, [entry.declaration]);
        return;
      }
    }
    removeStatement(editor, entry.exportStatement ?? entry.statement);
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
    remove: (members) => members.forEach((member) => removeEntry(entryOf(member))),
    replaceValue: (member, text) => {
      const { declaration } = entryOf(member);
      if (declaration.type === 'VariableDeclarator') {
        editor.edits.overwrite(declaration.init!.start, declaration.init!.end, text);
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
        const exported = entry.specifier.specifier.exported;
        editor.edits.overwrite(
          exported.start,
          exported.end,
          isValidIdentifier(name) ? name : printString(name, quote)
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
      removeEntry(entry);
      declare([{ key: name, value: valueSource(editor, member), text: '' }]);
    },
    group: (members, key) => {
      members.forEach((member) => removeEntry(entryOf(member)));
      const inner = members
        .map((member) => `${printKey(entryOf(member).name, quote)}: ${valueSource(editor, member)}`)
        .join(', ');
      declare([{ key, value: `{ ${inner} }`, text: '' }]);
    },
    take: (member, key) => {
      const value = valueSource(editor, member);
      return { key, value, text: `${printKey(key, quote)}: ${value}` };
    },
  };
};

const specifierList = (
  editor: SourceEditor,
  statement: E.ExportNamedDeclaration | E.ImportDeclaration
): List => {
  const open = editor.code.indexOf('{', statement.start) + 1;
  const close = editor.code.indexOf('}', open);
  return {
    open,
    close,
    items: statement.specifiers.filter(
      (specifier) =>
        specifier.type !== 'ImportDefaultSpecifier' && specifier.type !== 'ImportNamespaceSpecifier'
    ),
  };
};

export { specifierList };

export function createConfigObject(
  config: ConfigFile,
  report: (diagnostic: CsfMutationDiagnostic) => void,
  markChanged: () => void
): { ok: true; object: CsfObject } | { ok: false; diagnostic: CsfMutationDiagnostic } {
  const located = locateConfigRoot(config);
  if (located.ok === false) {
    return located;
  }
  const host: CsfObjectHost = {
    editor: config._editorSource,
    root: () => {
      const current = locateConfigRoot(config);
      return current.ok ? current.root : undefined;
    },
    commit: () => config._commit(),
  };
  return { ok: true, object: createCsfObject({ kind: 'config' }, host, [], report, markChanged) };
}

export { staticKey };
