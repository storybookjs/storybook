import { type E, type Node, isIdentifier, isStringLiteral } from './ast.ts';
import {
  type SourceEditor,
  appendToList,
  insertAfterImports,
  insertStatementAfter,
  objectList,
  prependStatement,
  printString,
  removeFromList,
  removeStatement,
  setImportSpecifiers,
} from './editor.ts';

/**
 * Bindings of a module: a string is the default import, an array holds named imports as `'name'`
 * or `'name as alias'`, `{ namespace }` is `import * as namespace`, and `null` a side-effect import.
 */
export type ImportBindings = string[] | string | { namespace: string } | null;

const isRequireOf = (node: Node | null | undefined, fromImport: string) =>
  node?.type === 'CallExpression' &&
  isIdentifier(node.callee, 'require') &&
  isStringLiteral(node.arguments[0]) &&
  isSource(node.arguments[0].value, fromImport);

// `node:path` also finds an import of `path`.
const isSource = (value: string, fromImport: string) =>
  value === fromImport || value === fromImport.split('node:')[1];

interface ImportName {
  imported: string;
  local: string;
}

// `'a as b'` imports `a` under the local name `b`.
const IMPORT_NAME = /^\s*([\p{L}\p{N}_$]+)(?:\s+as\s+([\p{L}\p{N}_$]+))?\s*$/u;

const importNames = (specifiers: readonly string[]) => {
  const names = new Map<string, ImportName>();
  for (const specifier of specifiers) {
    const match = IMPORT_NAME.exec(specifier);
    if (!match) {
      throw new Error(`Expected an import name like 'a' or 'a as b', got '${specifier}'`);
    }
    const [, imported, local = imported] = match;
    names.set(`${imported} as ${local}`, { imported, local });
  }
  return [...names.values()];
};

const printImportName = ({ imported, local }: ImportName, separator: string) =>
  imported === local ? imported : `${imported}${separator}${local}`;

const bindsImport = (name: ImportName, imported: Node, local: Node) =>
  isIdentifier(imported, name.imported) &&
  // `{ a = 1 }` binds `a` too.
  isIdentifier(local.type === 'AssignmentPattern' ? local.left : local, name.local);

// A plain name removes every import of that export, an alias only the import under that name.
const removesImport = (name: ImportName, imported: Node, local: Node) =>
  name.imported === name.local
    ? isIdentifier(imported, name.imported)
    : bindsImport(name, imported, local);

type ImportSpecifierNode = E.ImportDeclaration['specifiers'][number];

const isTypeOnly = (declaration: E.ImportDeclaration, specifier: ImportSpecifierNode) =>
  declaration.importKind === 'type' ||
  (specifier.type === 'ImportSpecifier' && specifier.importKind === 'type');

const findRequires = (editor: SourceEditor, fromImport: string) =>
  editor.program.body.filter(
    (node): node is E.VariableDeclaration =>
      node.type === 'VariableDeclaration' &&
      node.declarations.length === 1 &&
      isRequireOf(node.declarations[0].init, fromImport)
  );

const findImports = (editor: SourceEditor, fromImport: string) =>
  editor.program.body.filter(
    (node): node is E.ImportDeclaration =>
      node.type === 'ImportDeclaration' && isSource(node.source.value, fromImport)
  );

// Commits, and returns whether the edits written since the code was `before` changed it. A
// mutation may have left edits pending, which the commit's own answer would count.
const commitWritten = (editor: SourceEditor, before: string) => {
  const wrote = editor.edits.toString() !== before;
  editor.commit();
  return wrote;
};

// Each edit commits, and returns whether it changed the code.
export const setRequireImport = (
  editor: SourceEditor,
  importSpecifier: string[] | string,
  fromImport: string
) => {
  const before = editor.edits.toString();
  const requires = findRequires(editor, fromImport);
  const call = requires[0]?.declarations[0].init as E.CallExpression | undefined;
  const source = printString(
    call ? (call.arguments[0] as E.StringLiteral).value : fromImport,
    editor.quote
  );
  const end = editor.semicolons ? ';' : '';
  const ids = requires.map((declaration) => declaration.declarations[0].id);

  if (typeof importSpecifier === 'string') {
    if (!ids.some((id) => isIdentifier(id, importSpecifier))) {
      prependStatement(editor, `const ${importSpecifier} = require(${source})${end}`);
    }
  } else {
    const patterns = ids.filter((id): id is E.ObjectPattern => id.type === 'ObjectPattern');
    const texts = importNames(importSpecifier)
      .filter(
        (name) =>
          !patterns.some((pattern) =>
            pattern.properties.some(
              (property) =>
                property.type === 'Property' && bindsImport(name, property.key, property.value)
            )
          )
      )
      .map((name) => printImportName(name, ': '));
    // Nothing may follow a rest element.
    const pattern = patterns.find((id) =>
      id.properties.every((property) => property.type === 'Property')
    );
    if (texts.length > 0 && pattern) {
      appendToList(editor, objectList(editor, pattern), texts);
    } else if (texts.length > 0) {
      prependStatement(editor, `const { ${texts.join(', ')} } = require(${source})${end}`);
    }
  }
  return commitWritten(editor, before);
};

// Edits planned on the code as it is. A removal commits before the edits after it are planned, as
// where they go depends on the code it leaves.
type ImportPlan =
  | {
      kind: 'remove';
      removedStatements: Node[];
      keptSpecifiers: Map<E.ImportDeclaration, ImportSpecifierNode[]>;
      removedProperties: Map<E.ObjectPattern, Node[]>;
    }
  | { kind: 'merge'; into: E.ImportDeclaration; specifiers: { default?: string; named?: string[] } }
  // Without a statement to follow, it goes after all imports.
  | { kind: 'declare'; statement: string; after: E.ImportDeclaration | undefined };

type RemovalPlan = Extract<ImportPlan, { kind: 'remove' }>;

const removalPlan = (): RemovalPlan => ({
  kind: 'remove',
  removedStatements: [],
  keptSpecifiers: new Map(),
  removedProperties: new Map(),
});

const planSpecifierRemoval = (
  imports: readonly E.ImportDeclaration[],
  matches: (declaration: E.ImportDeclaration, specifier: ImportSpecifierNode) => boolean
) => {
  const plan = removalPlan();
  for (const declaration of imports) {
    const kept = declaration.specifiers.filter((specifier) => !matches(declaration, specifier));
    if (kept.length === 0 && declaration.specifiers.length > 0) {
      plan.removedStatements.push(declaration);
    } else if (kept.length < declaration.specifiers.length) {
      plan.keptSpecifiers.set(declaration, kept);
    }
  }
  return plan;
};

const commitImportPlan = (editor: SourceEditor, plan: ImportPlan | undefined) => {
  const before = editor.edits.toString();
  switch (plan?.kind) {
    case 'remove':
      plan.removedStatements.forEach((statement) => removeStatement(editor, statement));
      for (const [pattern, properties] of plan.removedProperties) {
        removeFromList(editor, objectList(editor, pattern), properties);
      }
      for (const [declaration, kept] of plan.keptSpecifiers) {
        setImportSpecifiers(editor, declaration, kept);
      }
      break;
    case 'merge':
      setImportSpecifiers(editor, plan.into, plan.into.specifiers, plan.specifiers);
      break;
    case 'declare':
      if (plan.after) {
        insertStatementAfter(editor, plan.after, plan.statement);
      } else {
        insertAfterImports(editor, plan.statement);
      }
      break;
    default:
      plan satisfies undefined;
  }
  return commitWritten(editor, before);
};

const hasSpecifier = (declaration: E.ImportDeclaration, type: ImportSpecifierNode['type']) =>
  declaration.specifiers.some((specifier) => specifier.type === type);

// Plans what the module's value imports do not already bind. A default goes into the first value
// import without a default, and named imports into the first without `* as`, which they cannot
// share a clause with. Otherwise, as a namespace import always does, it gets a declaration of its
// own after the module's value imports, which keeps the module evaluation order. A side-effect
// import is only added to a module without value imports.
const planAddition = (
  editor: SourceEditor,
  importSpecifier: ImportBindings,
  fromImport: string,
  spelled: string
): ImportPlan | undefined => {
  const values = findImports(editor, fromImport).filter(
    (declaration) => declaration.importKind !== 'type'
  );
  const specifiers = values.flatMap((declaration) =>
    declaration.specifiers.filter((specifier) => !isTypeOnly(declaration, specifier))
  );
  const source = printString(spelled, editor.quote);
  const end = editor.semicolons ? ';' : '';
  const declare = (clause?: string): ImportPlan => ({
    kind: 'declare',
    statement: `import ${clause ? `${clause} from ` : ''}${source}${end}`,
    after: values.at(-1),
  });
  // Handle side-effect imports (e.g., import 'foo')
  if (importSpecifier === null) {
    return values.length === 0 ? declare() : undefined;
  }
  // Handle default imports e.g. import foo from 'bar'
  if (typeof importSpecifier === 'string') {
    if (
      specifiers.some(
        (specifier) =>
          specifier.type === 'ImportDefaultSpecifier' && specifier.local.name === importSpecifier
      )
    ) {
      return undefined;
    }
    const into = values.find((declaration) => !hasSpecifier(declaration, 'ImportDefaultSpecifier'));
    return into
      ? { kind: 'merge', into, specifiers: { default: importSpecifier } }
      : declare(importSpecifier);
  }
  // Handle named imports e.g. import { foo } from 'bar'
  if (Array.isArray(importSpecifier)) {
    const texts = importNames(importSpecifier)
      .filter(
        (name) =>
          !specifiers.some(
            (specifier) =>
              specifier.type === 'ImportSpecifier' &&
              bindsImport(name, specifier.imported, specifier.local)
          )
      )
      .map((name) => printImportName(name, ' as '));
    if (texts.length === 0) {
      return undefined;
    }
    const into = values.find(
      (declaration) => !hasSpecifier(declaration, 'ImportNamespaceSpecifier')
    );
    return into
      ? { kind: 'merge', into, specifiers: { named: texts } }
      : declare(`{ ${texts.join(', ')} }`);
  }
  // Handle namespace imports e.g. import * as foo from 'bar'
  const { namespace } = importSpecifier;
  const bound = specifiers.some(
    (specifier) =>
      specifier.type === 'ImportNamespaceSpecifier' && specifier.local.name === namespace
  );
  return namespace && !bound ? declare(`* as ${namespace}`) : undefined;
};

export const setImport = (
  editor: SourceEditor,
  importSpecifier: ImportBindings,
  fromImport: string
) => {
  const names = Array.isArray(importSpecifier) ? importNames(importSpecifier) : [];
  const imports = findImports(editor, fromImport);
  const spelled = imports[0]?.source.value ?? fromImport;
  // A type-only binding of a name to import as a value would clash with it, so it goes.
  const clashes = planSpecifierRemoval(
    imports,
    (declaration, specifier) =>
      isTypeOnly(declaration, specifier) &&
      (specifier.type === 'ImportSpecifier'
        ? names.some((name) => bindsImport(name, specifier.imported, specifier.local))
        : specifier.type === 'ImportDefaultSpecifier' && specifier.local.name === importSpecifier)
  );
  const removed = commitImportPlan(editor, clashes);
  const added = commitImportPlan(
    editor,
    planAddition(editor, importSpecifier, fromImport, spelled)
  );
  return added || removed;
};

// require() has no side-effect only or namespace forms, so those are skipped.
const planRequireRemoval = (
  editor: SourceEditor,
  importSpecifier: ImportBindings,
  fromImport: string
) => {
  const plan = removalPlan();
  const names = Array.isArray(importSpecifier) ? importNames(importSpecifier) : undefined;
  for (const declaration of findRequires(editor, fromImport)) {
    const { id } = declaration.declarations[0];
    // Handle default requires e.g. const foo = require('bar')
    if (typeof importSpecifier === 'string' && isIdentifier(id, importSpecifier)) {
      plan.removedStatements.push(declaration);
    }
    // Handle named requires e.g. const { foo, bar } = require('baz')
    if (!names || id.type !== 'ObjectPattern') {
      continue;
    }
    const removed = id.properties.filter(
      (property) =>
        property.type === 'Property' &&
        names.some((name) => removesImport(name, property.key, property.value))
    );
    if (removed.length === id.properties.length) {
      plan.removedStatements.push(declaration);
    } else if (removed.length > 0) {
      plan.removedProperties.set(id, removed);
    }
  }
  return plan;
};

const planImportRemoval = (
  editor: SourceEditor,
  importSpecifier: ImportBindings,
  fromImport: string
) => {
  const imports = findImports(editor, fromImport);
  // Remove side-effect imports (e.g., import 'foo') if exact match, else do nothing.
  if (importSpecifier === null) {
    return {
      ...removalPlan(),
      removedStatements: imports.filter((declaration) => declaration.specifiers.length === 0),
    };
  }
  const names = Array.isArray(importSpecifier) ? importNames(importSpecifier) : [];
  return planSpecifierRemoval(imports, (declaration, specifier) => {
    if (isTypeOnly(declaration, specifier)) {
      return false;
    }
    // Handle default imports e.g. import foo from 'bar'
    if (typeof importSpecifier === 'string') {
      return (
        specifier.type === 'ImportDefaultSpecifier' && specifier.local.name === importSpecifier
      );
    }
    // Handle named imports e.g. import { foo } from 'bar'
    if (Array.isArray(importSpecifier)) {
      return (
        specifier.type === 'ImportSpecifier' &&
        names.some((name) => removesImport(name, specifier.imported, specifier.local))
      );
    }
    // Handle namespace imports e.g. import * as foo from 'bar'
    return (
      specifier.type === 'ImportNamespaceSpecifier' &&
      specifier.local.name === importSpecifier.namespace
    );
  });
};

export const removeImport = (
  editor: SourceEditor,
  importSpecifier: ImportBindings,
  fromImport: string
) => {
  const requires = commitImportPlan(
    editor,
    planRequireRemoval(editor, importSpecifier, fromImport)
  );
  const imports = commitImportPlan(editor, planImportRemoval(editor, importSpecifier, fromImport));
  return imports || requires;
};
