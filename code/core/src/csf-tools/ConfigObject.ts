import { type NodePath, traverse, types as t } from 'storybook/internal/babel';

import type { ConfigFile } from './ConfigFile.ts';
import { type CsfMutationDiagnostic, type CsfObject, createCsfObject } from './CsfObject.ts';
import { pathForNode } from './story-shape/index.ts';

type NamedExport = {
  declaration: NodePath<t.VariableDeclarator>;
  specifier?: NodePath<t.ExportSpecifier>;
};

const isExportReference = (reference: NodePath) =>
  reference.isExportNamedDeclaration() ||
  reference.parentPath?.isExportDefaultDeclaration() ||
  reference.parentPath?.isExportSpecifier() ||
  (reference.parentPath?.isAssignmentExpression() &&
    t.isMemberExpression(reference.parentPath.node.left) &&
    t.isIdentifier(reference.parentPath.node.left.object, { name: 'module' }) &&
    t.isIdentifier(reference.parentPath.node.left.property, { name: 'exports' }));

export function discoverConfigObjects(
  config: ConfigFile,
  report: (diagnostic: CsfMutationDiagnostic) => void,
  markChanged: () => void
): CsfObject[] {
  let objects: CsfObject[] = [];
  const reject = (node: t.Node, code: CsfMutationDiagnostic['code'], message: string) => {
    report({
      code,
      target: { kind: 'config' },
      path: [],
      message,
      ...(node.loc ? { loc: node.loc } : {}),
    });
  };

  traverse(config._ast, {
    Program(program) {
      program.stop();
      const root = pathForNode(program, config._exportsObject);
      if (root) {
        const statement = root.getStatementParent();
        if (!statement?.parentPath.isProgram() && !statement?.parentPath.isExportNamedDeclaration()) {
          reject(root.node, 'unsupported-initializer', 'Cannot mutate a config declared inside a function or conditional');
          return;
        }
        const declaration = root.findParent((parent) => parent.isVariableDeclarator());
        if (declaration?.isVariableDeclarator() && t.isIdentifier(declaration.node.id)) {
          const binding = declaration.scope.getBinding(declaration.node.id.name);
          if (!binding?.constant || binding.referencePaths.length !== 1 || !binding.referencePaths.every(isExportReference)) {
            reject(declaration.node, 'ambiguous-binding', 'Cannot mutate a shared or reassigned config binding');
            return;
          }
        }
        const assignments: NodePath<t.AssignmentExpression>[] = [];
        program.traverse({
          AssignmentExpression(path) {
            const { left } = path.node;
            if (
              t.isMemberExpression(left) &&
              t.isIdentifier(left.object, { name: 'module' }) &&
              t.isIdentifier(left.property, { name: 'exports' })
            ) {
              assignments.push(path);
            }
          },
        });
        if (
          assignments.length > 1 ||
          assignments.some((assignment) =>
            assignment.scope.hasBinding('module') ||
            (t.isMemberExpression(assignment.node.left) && assignment.node.left.computed) ||
            !assignment.parentPath.parentPath?.isProgram()
          )
        ) {
          reject(root.node, 'ambiguous-binding', 'Cannot mutate conditional, repeated, or shadowed module.exports');
          return;
        }
        objects = [createCsfObject({ kind: 'config' }, root, [], report, markChanged)];
        return;
      }

      if (config.hasDefaultExport) {
        reject(config._ast.program, 'unsupported-initializer', 'Cannot mutate a config without a static object initializer');
        return;
      }

      const named = new Map<t.ObjectProperty, NamedExport>();
      const virtualRoot = t.objectExpression([]);
      const seen = new Set<t.Node>();
      for (const statement of program.get('body')) {
        if (
          statement.isExportAllDeclaration() ||
          (statement.isExportNamedDeclaration() && statement.node.source)
        ) {
          reject(statement.node, 'unsupported-initializer', 'Cannot mutate re-exported config fields');
          return;
        }
      }

      for (const [name, node] of Object.entries(config._exportDecls)) {
        const declaration = pathForNode(program, node);
        if (
          !declaration?.isVariableDeclarator() ||
          !t.isIdentifier(declaration.node.id) ||
          !t.isExpression(declaration.node.init)
        ) {
          reject(node, 'unsupported-initializer', `Cannot mutate the ${name} export without an expression initializer`);
          return;
        }
        const binding = declaration.scope.getBinding(declaration.node.id.name);
        if (!binding?.constant || seen.has(node) || !binding.referencePaths.every(isExportReference)) {
          reject(node, 'ambiguous-binding', `Cannot mutate the shared or reassigned ${name} export`);
          return;
        }
        seen.add(node);
        const reference = binding.referencePaths.find((path) => path.parentPath?.isExportSpecifier());
        const specifier = reference?.parentPath;
        const property = t.objectProperty(t.stringLiteral(name), declaration.node.init);
        virtualRoot.properties.push(property);
        named.set(property, {
          declaration,
          ...(specifier?.isExportSpecifier() ? { specifier } : {}),
        });
      }

      const syncExports = () => {
        for (const [property, entry] of named) {
          if (!virtualRoot.properties.includes(property)) {
            if (entry.specifier) {
              entry.specifier.remove();
            } else {
              entry.declaration.remove();
            }
            named.delete(property);
          }
        }
        for (const property of virtualRoot.properties) {
          if (!t.isObjectProperty(property) || !t.isExpression(property.value)) {
            continue;
          }
          const name = t.isIdentifier(property.key) ? property.key.name :
            t.isStringLiteral(property.key) ? property.key.value : undefined;
          if (name === undefined) {
            continue;
          }
          const entry = named.get(property);
          if (entry) {
            entry.declaration.node.init = property.value;
            if (entry.specifier) {
              entry.specifier.node.exported = t.isValidIdentifier(name)
                ? t.identifier(name) : t.stringLiteral(name);
              continue;
            }
            if (t.isValidIdentifier(name) &&
              (t.isIdentifier(entry.declaration.node.id, { name }) || !program.scope.hasBinding(name))) {
              entry.declaration.node.id = t.identifier(name);
              continue;
            }
            entry.declaration.remove();
          }
          const id = t.isValidIdentifier(name) && !program.scope.hasBinding(name)
            ? t.identifier(name) : program.scope.generateUidIdentifier(name);
          const declaration = t.variableDeclarator(id, property.value);
          const variable = t.variableDeclaration('const', [declaration]);
          if (id.name === name) {
            program.pushContainer('body', t.exportNamedDeclaration(variable));
          } else {
            const specifier = t.exportSpecifier(id, t.isValidIdentifier(name) ? t.identifier(name) : t.stringLiteral(name));
            program.pushContainer('body', [variable, t.exportNamedDeclaration(null, [specifier])]);
          }
          const declarationPath = pathForNode(program, declaration);
          if (declarationPath) {
            const specifierPath = program.get('body').flatMap((statement) =>
              statement.isExportNamedDeclaration() ? statement.get('specifiers') : []
            ).find((specifier) => specifier.isExportSpecifier() && specifier.node.local === id);
            named.set(property, {
              declaration: declarationPath,
              ...(specifierPath?.isExportSpecifier() ? { specifier: specifierPath } : {}),
            });
          }
        }
        program.scope.crawl();
        markChanged();
      };

      objects = [createCsfObject(
        { kind: 'config' },
        { node: virtualRoot, buildCodeFrameError: program.buildCodeFrameError.bind(program) },
        [], report, syncExports
      )];
    },
  });
  return objects;
}
