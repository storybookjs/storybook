import { type NodePath, traverse, types as t } from 'storybook/internal/babel';

import type { ConfigFile } from './ConfigFile.ts';
import { type CsfMutationDiagnostic, type CsfObject, createCsfObject } from './CsfObject.ts';
import { pathForNode } from './story-shape/index.ts';

type NamedExport = {
  declaration: NodePath<t.VariableDeclarator | t.FunctionDeclaration>;
  specifier?: NodePath<t.ExportSpecifier>;
};

const isConfigFactory = (callee: NodePath): boolean => {
  if (!callee.isIdentifier()) {
    return false;
  }
  const binding = callee.scope.getBinding(callee.node.name);
  const name = binding?.path.isImportSpecifier()
    ? binding.path.node.imported
    : !binding
      ? callee.node
      : undefined;
  return (
    t.isIdentifier(name) && ['defineMain', 'definePreview', 'defineConfig'].includes(name.name)
  );
};

const isExportReference = (reference: NodePath): boolean => {
  const parent = reference.parentPath;
  if (!parent) {
    return false;
  }
  if (
    parent.isTSAsExpression() ||
    parent.isTSSatisfiesExpression() ||
    parent.isTSNonNullExpression()
  ) {
    return isExportReference(parent);
  }
  return (
    reference.isExportNamedDeclaration() ||
    parent.isExportDefaultDeclaration() ||
    parent.isExportSpecifier() ||
    (parent.isAssignmentExpression() &&
      t.isMemberExpression(parent.node.left) &&
      t.isIdentifier(parent.node.left.object, { name: 'module' }) &&
      t.isIdentifier(parent.node.left.property, { name: 'exports' }))
  );
};

export function createConfigObject(
  config: ConfigFile,
  mode: 'read' | 'mutate',
  path: readonly string[] | undefined,
  report: (diagnostic: CsfMutationDiagnostic) => void,
  markChanged: () => void
): { ok: true; object: CsfObject } | { ok: false; diagnostic: CsfMutationDiagnostic } {
  let result: { ok: true; object: CsfObject } | { ok: false; diagnostic: CsfMutationDiagnostic } = {
    ok: false,
    diagnostic: {
      code: 'unsupported-initializer',
      target: { kind: 'config' },
      path: [],
      message: 'Cannot find a mutable config root',
    },
  };
  const reject = (node: t.Node, code: CsfMutationDiagnostic['code'], message: string) => {
    result = {
      ok: false,
      diagnostic: {
        code,
        target: { kind: 'config' },
        path: [],
        message,
        ...(node.loc ? { loc: node.loc } : {}),
      },
    };
  };

  traverse(config._ast, {
    Program(program) {
      program.stop();
      const assignments: NodePath<t.AssignmentExpression>[] = [];
      program.traverse({
        AssignmentExpression(path) {
          const { left } = path.node;
          if (
            t.isMemberExpression(left) &&
            ((t.isIdentifier(left.object, { name: 'module' }) &&
              (t.isIdentifier(left.property, { name: 'exports' }) ||
                t.isStringLiteral(left.property, { value: 'exports' }))) ||
              t.isIdentifier(left.object, { name: 'exports' }))
          ) {
            assignments.push(path);
          }
        },
      });
      const root = pathForNode(program, config._exportsObject);
      let useNamedExports = false;
      if (root) {
        const declaration = root.findParent((parent) => parent.isVariableDeclarator());
        const foreignDecls = Object.entries(config._exportDecls).filter(
          ([, exported]) => exported !== declaration?.node
        );
        if (foreignDecls.length > 0) {
          // The exports map is last-parse-wins, so a path defined by several exports is ambiguous.
          // Resolve it to its single owning export instead: refuse when both the default and a
          // named export define it, and edit the named export directly when only it holds the path.
          const reads = (rootNode: t.Node | undefined, subPath: readonly string[]): boolean =>
            t.isObjectExpression(rootNode) &&
            subPath.length > 0 &&
            createCsfObject(
              { kind: 'config' },
              {
                node: rootNode,
                scope: program.scope,
                buildCodeFrameError: program.buildCodeFrameError.bind(program),
              },
              [],
              report,
              () => {}
            ).get(subPath) !== undefined;
          // The exports map is last-parse-wins, so the named value comes from its declaration.
          const namedValue = (name: string): t.Node | undefined => {
            const declPath = pathForNode(program, config._exportDecls[name]);
            return declPath?.isVariableDeclarator() ? (declPath.node.init ?? undefined) : undefined;
          };
          if (!path) {
            if (mode === 'mutate') {
              reject(
                root.node,
                'ambiguous-binding',
                'Cannot mutate mixed default and named config exports'
              );
              return;
            }
          } else {
            const defaultHolds = reads(root.node, path);
            const namedHolder = foreignDecls.find(
              ([name]) => path[0] === name && reads(namedValue(name), path.slice(1))
            );
            if (defaultHolds && namedHolder) {
              reject(
                root.node,
                'ambiguous-binding',
                `Cannot resolve ${path.join('.')} because both the default export and the named ${namedHolder[0]} export define it`
              );
              return;
            }
            useNamedExports = !defaultHolds && Boolean(namedHolder);
          }
        }
        if (!useNamedExports) {
          for (
            let parent: NodePath | null = root.parentPath;
            parent && !parent.isProgram();
            parent = parent.parentPath
          ) {
            if (!parent.isCallExpression()) {
              continue;
            }
            const callee = parent.get('callee');
            const typeChain =
              callee.isMemberExpression() &&
              !callee.node.computed &&
              t.isIdentifier(callee.node.property, { name: 'type' }) &&
              parent.node.arguments.length === 0;
            if (!typeChain && !(isConfigFactory(callee) && parent.node.arguments.length === 1)) {
              reject(
                parent.node,
                'unsupported-initializer',
                'Cannot mutate an arbitrary config factory call'
              );
              return;
            }
          }
          const statement = root.getStatementParent();
          if (
            statement?.isExpressionStatement() &&
            (!t.isAssignmentExpression(statement.node.expression) ||
              !t.isMemberExpression(statement.node.expression.left) ||
              !t.isIdentifier(statement.node.expression.left.object, { name: 'module' }) ||
              !t.isIdentifier(statement.node.expression.left.property, { name: 'exports' }))
          ) {
            reject(
              root.node,
              'ambiguous-binding',
              'Cannot mutate a config that is not directly exported'
            );
            return;
          }
          if (
            !statement?.parentPath.isProgram() &&
            !statement?.parentPath.isExportNamedDeclaration()
          ) {
            reject(
              root.node,
              'unsupported-initializer',
              'Cannot mutate a config declared inside a function or conditional'
            );
            return;
          }
          if (declaration?.isVariableDeclarator() && t.isIdentifier(declaration.node.id)) {
            const binding = declaration.scope.getBinding(declaration.node.id.name);
            if (
              !binding?.constant ||
              binding.referencePaths.length !== 1 ||
              !binding.referencePaths.every(isExportReference)
            ) {
              reject(
                declaration.node,
                'ambiguous-binding',
                'Cannot mutate a shared or reassigned config binding'
              );
              return;
            }
          }
          if (
            assignments.length > 1 ||
            assignments.some(
              (assignment) =>
                assignment.scope.hasBinding('module') ||
                (t.isMemberExpression(assignment.node.left) && assignment.node.left.computed) ||
                !assignment.parentPath.parentPath?.isProgram()
            )
          ) {
            reject(
              root.node,
              'ambiguous-binding',
              'Cannot mutate conditional, repeated, or shadowed module.exports'
            );
            return;
          }
          result = {
            ok: true,
            object: createCsfObject({ kind: 'config' }, root, [], report, markChanged),
          };
          return;
        }
      }

      if (!root && (config.hasDefaultExport || assignments.length > 0)) {
        reject(
          config._ast.program,
          'unsupported-initializer',
          'Cannot mutate a config without a static object initializer'
        );
        return;
      }

      const named = new Map<t.ObjectProperty, NamedExport>();
      const virtualRoot = t.objectExpression([]);
      const seen = new Set<t.Node>();
      for (const statement of program.get('body')) {
        if (statement.isExportNamedDeclaration() && statement.node.exportKind === 'type') {
          continue;
        }
        if (
          statement.isExportAllDeclaration() ||
          (statement.isExportNamedDeclaration() && statement.node.source)
        ) {
          reject(
            statement.node,
            'unsupported-initializer',
            'Cannot mutate re-exported config fields'
          );
          return;
        }
        if (statement.isExportNamedDeclaration()) {
          for (const specifier of statement.get('specifiers')) {
            if (!specifier.isExportSpecifier() || specifier.node.exportKind === 'type') {
              continue;
            }
            const name = t.isIdentifier(specifier.node.exported)
              ? specifier.node.exported.name
              : specifier.node.exported.value;
            if (!Object.hasOwn(config._exportDecls, name)) {
              reject(
                specifier.node,
                'unsupported-initializer',
                `Cannot mutate the unresolved ${name} export`
              );
              return;
            }
          }
        }
      }

      for (const [name, node] of Object.entries(config._exportDecls)) {
        const declaration = pathForNode(program, node);
        if (
          !(declaration?.isVariableDeclarator() || declaration?.isFunctionDeclaration()) ||
          !t.isIdentifier(declaration.node.id)
        ) {
          reject(
            node,
            'unsupported-initializer',
            `Cannot mutate the ${name} export without an expression initializer`
          );
          return;
        }
        const binding = declaration.scope.getBinding(declaration.node.id.name);
        if (
          !binding?.constant ||
          seen.has(node) ||
          (mode === 'mutate' && !binding.referencePaths.every(isExportReference))
        ) {
          reject(
            node,
            'ambiguous-binding',
            `Cannot mutate the shared or reassigned ${name} export`
          );
          return;
        }
        seen.add(node);
        const reference = binding.referencePaths.find((path) =>
          path.parentPath?.isExportSpecifier()
        );
        const specifier = reference?.parentPath;
        const value = declaration.isFunctionDeclaration()
          ? t.toExpression(t.cloneNode(declaration.node))
          : declaration.node.init;
        if (!t.isExpression(value)) {
          reject(
            node,
            'unsupported-initializer',
            `Cannot mutate the ${name} export without an expression initializer`
          );
          return;
        }
        const property = t.objectProperty(t.stringLiteral(name), value);
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
          const name = t.isIdentifier(property.key)
            ? property.key.name
            : t.isStringLiteral(property.key)
              ? property.key.value
              : undefined;
          if (name === undefined) {
            continue;
          }
          const entry = named.get(property);
          if (entry) {
            if (entry.declaration.isFunctionDeclaration()) {
              if (
                t.isFunctionExpression(property.value) &&
                (!property.value.id || property.value.id.name === entry.declaration.node.id?.name)
              ) {
                const { params, body, async, generator, returnType, typeParameters } =
                  property.value;
                Object.assign(entry.declaration.node, {
                  params,
                  body,
                  async,
                  generator,
                  returnType,
                  typeParameters,
                });
              } else {
                const id = entry.declaration.node.id;
                if (!id) {
                  continue;
                }
                const variable = t.variableDeclarator(id, property.value);
                entry.declaration.replaceWith(t.variableDeclaration('const', [variable]));
                const path = pathForNode(program, variable);
                if (path) {
                  entry.declaration = path;
                }
              }
            } else if (entry.declaration.isVariableDeclarator()) {
              entry.declaration.node.init = property.value;
            }
            if (entry.specifier) {
              entry.specifier.node.exported = t.isValidIdentifier(name)
                ? t.identifier(name)
                : t.stringLiteral(name);
              continue;
            }
            if (
              t.isValidIdentifier(name) &&
              (t.isIdentifier(entry.declaration.node.id, { name }) ||
                !program.scope.hasBinding(name))
            ) {
              entry.declaration.node.id = t.identifier(name);
              continue;
            }
            entry.declaration.remove();
          }
          const id =
            t.isValidIdentifier(name) && !program.scope.hasBinding(name)
              ? t.identifier(name)
              : program.scope.generateUidIdentifier(name);
          const declaration = t.variableDeclarator(id, property.value);
          const variable = t.variableDeclaration('const', [declaration]);
          if (id.name === name) {
            program.pushContainer('body', t.exportNamedDeclaration(variable));
          } else {
            const specifier = t.exportSpecifier(
              id,
              t.isValidIdentifier(name) ? t.identifier(name) : t.stringLiteral(name)
            );
            program.pushContainer('body', [variable, t.exportNamedDeclaration(null, [specifier])]);
          }
          const declarationPath = pathForNode(program, declaration);
          if (declarationPath) {
            const specifierPath = program
              .get('body')
              .flatMap((statement) =>
                statement.isExportNamedDeclaration() ? statement.get('specifiers') : []
              )
              .find((specifier) => specifier.isExportSpecifier() && specifier.node.local === id);
            named.set(property, {
              declaration: declarationPath,
              ...(specifierPath?.isExportSpecifier() ? { specifier: specifierPath } : {}),
            });
          }
        }
        program.scope.crawl();
        markChanged();
      };

      result = {
        ok: true,
        object: createCsfObject(
          { kind: 'config' },
          {
            node: virtualRoot,
            detached: true,
            scope: program.scope,
            buildCodeFrameError: program.buildCodeFrameError.bind(program),
          },
          [],
          report,
          syncExports
        ),
      };
    },
  });
  return result;
}
