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

// Removes the matching specifiers of a module's imports, and each import left without any.
const removeImportSpecifiers = (
  editor: SourceEditor,
  fromImport: string,
  matches: (declaration: E.ImportDeclaration, specifier: ImportSpecifierNode) => boolean
) => {
  for (const declaration of findImports(editor, fromImport)) {
    const kept = declaration.specifiers.filter((specifier) => !matches(declaration, specifier));
    if (kept.length === 0 && declaration.specifiers.length > 0) {
      removeStatement(editor, declaration);
    } else if (kept.length < declaration.specifiers.length) {
      setImportSpecifiers(editor, declaration, kept);
    }
  }
};

// Each edit commits, and returns whether it changed the code.
export const setRequireImport = (
  editor: SourceEditor,
  importSpecifier: string[] | string,
  fromImport: string
) => {
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
  return editor.commit();
};

export const setImport = (
  editor: SourceEditor,
  importSpecifier: ImportBindings,
  fromImport: string
) => {
  const names = Array.isArray(importSpecifier) ? importNames(importSpecifier) : [];
  const spelled = findImports(editor, fromImport)[0]?.source.value ?? fromImport;
  // A type-only binding of a name to import as a value would clash with it, so it goes.
  removeImportSpecifiers(
    editor,
    fromImport,
    (declaration, specifier) =>
      isTypeOnly(declaration, specifier) &&
      (specifier.type === 'ImportSpecifier'
        ? names.some((name) => bindsImport(name, specifier.imported, specifier.local))
        : specifier.type === 'ImportDefaultSpecifier' && specifier.local.name === importSpecifier)
  );
  const removed = editor.commit();

  const values = findImports(editor, fromImport).filter(
    (declaration) => declaration.importKind !== 'type'
  );
  const source = printString(spelled, editor.quote);
  const end = editor.semicolons ? ';' : '';
  const specifiers = values.flatMap((declaration) =>
    declaration.specifiers.filter((specifier) => !isTypeOnly(declaration, specifier))
  );
  // A clause goes into the first value import without a specifier that blocks it. Otherwise it
  // gets a declaration of its own after the module's value imports, or after all imports, which
  // keeps the module evaluation order.
  const addImport = (
    clause: string,
    merged?: { blockedBy: string; specifiers: { default?: string; named?: string[] } }
  ) => {
    const target =
      merged &&
      values.find(
        (declaration) =>
          !declaration.specifiers.some((specifier) => specifier.type === merged.blockedBy)
      );
    if (target) {
      setImportSpecifiers(editor, target, target.specifiers, merged.specifiers);
    } else if (values.length > 0) {
      insertStatementAfter(editor, values.at(-1)!, `import ${clause} from ${source}${end}`);
    } else {
      insertAfterImports(editor, `import ${clause} from ${source}${end}`);
    }
  };

  // Handle side-effect imports (e.g., import 'foo')
  if (importSpecifier === null) {
    if (values.length === 0) {
      insertAfterImports(editor, `import ${source}${end}`);
    }
    // Handle default imports e.g. import foo from 'bar'
  } else if (typeof importSpecifier === 'string') {
    if (
      !specifiers.some(
        (specifier) =>
          specifier.type === 'ImportDefaultSpecifier' && specifier.local.name === importSpecifier
      )
    ) {
      addImport(importSpecifier, {
        blockedBy: 'ImportDefaultSpecifier',
        specifiers: { default: importSpecifier },
      });
    }
    // Handle named imports e.g. import { foo } from 'bar'
  } else if (Array.isArray(importSpecifier)) {
    const texts = names
      .filter(
        (name) =>
          !specifiers.some(
            (specifier) =>
              specifier.type === 'ImportSpecifier' &&
              bindsImport(name, specifier.imported, specifier.local)
          )
      )
      .map((name) => printImportName(name, ' as '));
    if (texts.length > 0) {
      addImport(`{ ${texts.join(', ')} }`, {
        blockedBy: 'ImportNamespaceSpecifier',
        specifiers: { named: texts },
      });
    }
    // Handle namespace imports e.g. import * as foo from 'bar'
  } else if (
    importSpecifier.namespace &&
    !specifiers.some(
      (specifier) =>
        specifier.type === 'ImportNamespaceSpecifier' &&
        specifier.local.name === importSpecifier.namespace
    )
  ) {
    addImport(`* as ${importSpecifier.namespace}`);
  }
  return editor.commit() || removed;
};

const removeRequireImport = (
  editor: SourceEditor,
  importSpecifier: ImportBindings,
  fromImport: string
) => {
  // require() has no side-effect only or namespace forms, so those are skipped.
  const names = Array.isArray(importSpecifier) ? importNames(importSpecifier) : undefined;
  for (const declaration of findRequires(editor, fromImport)) {
    const { id } = declaration.declarations[0];
    // Handle default requires e.g. const foo = require('bar')
    if (typeof importSpecifier === 'string' && isIdentifier(id, importSpecifier)) {
      removeStatement(editor, declaration);
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
      removeStatement(editor, declaration);
    } else if (removed.length > 0) {
      removeFromList(editor, objectList(editor, id), removed);
    }
  }
};

const removeModuleImport = (
  editor: SourceEditor,
  importSpecifier: ImportBindings,
  fromImport: string
) => {
  // Remove side-effect imports (e.g., import 'foo') if exact match, else do nothing.
  if (importSpecifier === null) {
    for (const declaration of findImports(editor, fromImport)) {
      if (declaration.specifiers.length === 0) {
        removeStatement(editor, declaration);
      }
    }
    return;
  }
  const names = Array.isArray(importSpecifier) ? importNames(importSpecifier) : [];
  removeImportSpecifiers(editor, fromImport, (declaration, specifier) => {
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
  removeRequireImport(editor, importSpecifier, fromImport);
  const requires = editor.commit();
  removeModuleImport(editor, importSpecifier, fromImport);
  return editor.commit() || requires;
};
