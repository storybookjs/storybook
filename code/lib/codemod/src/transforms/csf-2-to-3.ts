/* eslint-disable no-underscore-dangle */
import type { BabelFile, NodePath } from '@storybook/core/babel';
import { core as babel, types as t } from '@storybook/core/babel';

import type { CsfFile } from '@storybook/core/csf-tools';
import { loadCsf, printCsf } from '@storybook/core/csf-tools';

import type { API, FileInfo } from 'jscodeshift';
import prettier from 'prettier';
import invariant from 'tiny-invariant';

import { upgradeDeprecatedTypes } from './upgrade-deprecated-types';

const { isIdentifier, isTSTypeAnnotation, isTSTypeReference } = t;

const logger = console;

const renameAnnotation = (annotation: string) => {
  return annotation === 'storyName' ? 'name' : annotation;
};

const getTemplateBindVariable = (init: t.Expression | undefined) =>
  t.isCallExpression(init) &&
  t.isMemberExpression(init.callee) &&
  t.isIdentifier(init.callee.object) &&
  t.isIdentifier(init.callee.property) &&
  init.callee.property.name === 'bind' &&
  (init.arguments.length === 0 ||
    (init.arguments.length === 1 &&
      t.isObjectExpression(init.arguments[0]) &&
      init.arguments[0].properties.length === 0))
    ? init.callee.object.name
    : null;

// export const A = ...
// A.parameters = { ... }; <===
const isStoryAnnotation = (stmt: t.Statement, objectExports: Record<string, any>) =>
  t.isExpressionStatement(stmt) &&
  t.isAssignmentExpression(stmt.expression) &&
  t.isMemberExpression(stmt.expression.left) &&
  t.isIdentifier(stmt.expression.left.object) &&
  objectExports[stmt.expression.left.object.name];

const getNewExport = (stmt: t.Statement, objectExports: Record<string, any>) => {
  if (
    t.isExportNamedDeclaration(stmt) &&
    t.isVariableDeclaration(stmt.declaration) &&
    stmt.declaration.declarations.length === 1
  ) {
    const decl = stmt.declaration.declarations[0];
    if (t.isVariableDeclarator(decl) && t.isIdentifier(decl.id)) {
      return objectExports[decl.id.name];
    }
  }
  return null;
};

// Remove render function when it matches the global render function in react
// export default { component: Cat };
// export const A = (args) => <Cat {...args} />;
const isReactGlobalRenderFn = (csf: CsfFile, storyFn: t.Expression) => {
  if (
    csf._meta?.component &&
    t.isArrowFunctionExpression(storyFn) &&
    storyFn.params.length === 1 &&
    t.isJSXElement(storyFn.body)
  ) {
    const { openingElement } = storyFn.body;
    if (
      openingElement.selfClosing &&
      t.isJSXIdentifier(openingElement.name) &&
      openingElement.attributes.length === 1
    ) {
      const attr = openingElement.attributes[0];
      const param = storyFn.params[0];
      if (
        t.isJSXSpreadAttribute(attr) &&
        t.isIdentifier(attr.argument) &&
        t.isIdentifier(param) &&
        param.name === attr.argument.name &&
        csf._meta.component === openingElement.name.name
      ) {
        return true;
      }
    }
  }
  return false;
};

// A simple CSF story is a no-arg story without any extra annotations (params, args, etc.)
const isSimpleCSFStory = (init: t.Expression, annotations: t.ObjectProperty[]) =>
  annotations.length === 0 && t.isArrowFunctionExpression(init) && init.params.length === 0;

function removeUnusedTemplates(csf: CsfFile) {
  Object.entries(csf._templates).forEach(([template, templateExpression]) => {
    const references: NodePath[] = [];
    babel.traverse(csf._ast, {
      Identifier: (path) => {
        if (path.node.name === template) {
          references.push(path as NodePath);
        }
      },
    });
    // if there is only one reference and this reference is the variable declaration initializing the template
    // then we are sure the template is unused
    if (references.length === 1) {
      const reference = references[0];
      if (
        reference.parentPath?.isVariableDeclarator() &&
        reference.parentPath.node.init === templateExpression
      ) {
        reference.parentPath.remove();
      }
    }
  });
}

export default async function transform(info: FileInfo, api: API, options: { parser?: string }) {
  const makeTitle = (userTitle?: string) => {
    return userTitle || 'FIXME';
  };
  const csf = loadCsf(info.source, { makeTitle });

  try {
    csf.parse();
  } catch (err) {
    logger.log(`Error ${err}, skipping`);
    return info.source;
  }

  // This allows for showing buildCodeFrameError messages
  // @ts-expect-error File is not yet exposed, see https://github.com/babel/babel/issues/11350#issuecomment-644118606

  const file: BabelFile = new babel.File(
    { filename: info.path },
    { code: info.source, ast: csf._ast }
  );

  const importHelper = new StorybookImportHelper(file, info);

  const objectExports: Record<string, t.Statement> = {};
  Object.entries(csf._storyExports).forEach(([key, decl]) => {
    const annotations = Object.entries(csf._storyAnnotations[key]).map(([annotation, val]) => {
      return t.objectProperty(t.identifier(renameAnnotation(annotation)), val as t.Expression);
    });

    if (t.isVariableDeclarator(decl as t.Node)) {
      const { init, id } = decl as any;
      invariant(init, 'Inital value should be declared');
      // only replace arrow function expressions && template
      const template = getTemplateBindVariable(init);

      if (!t.isArrowFunctionExpression(init) && !template) {
        return;
      }
      // Do change the type of no-arg stories without annotations to StoryFn when applicable
      // Do change the type of no-arg stories without annotations to StoryFn when applicable
      if (isSimpleCSFStory(init, annotations)) {
        objectExports[key] = t.exportNamedDeclaration(
          t.variableDeclaration('const', [
            t.variableDeclarator(importHelper.updateTypeTo(id, 'StoryFn'), init),
          ])
        );
        return;
      }

      const storyFn: t.Expression = template ? t.identifier(template) : init;

      // Remove the render function when we can hoist the template
      // const Template = (args) => <Cat {...args} />;
      // export const A = Template.bind({});
      const renderAnnotation = isReactGlobalRenderFn(
        csf,
        template ? csf._templates[template] : storyFn
      )
        ? []
        : [t.objectProperty(t.identifier('render'), storyFn)];

      objectExports[key] = t.exportNamedDeclaration(
        t.variableDeclaration('const', [
          t.variableDeclarator(
            importHelper.updateTypeTo(id, 'StoryObj'),
            t.objectExpression([...renderAnnotation, ...annotations])
          ),
        ])
      );
    }
  });

  csf._ast.program.body = csf._ast.program.body.reduce((acc: t.Statement[], stmt: t.Statement) => {
    const statement = stmt;
    // remove story annotations & template declarations
    if (isStoryAnnotation(statement, objectExports)) {
      return acc;
    }

    // replace story exports with new object exports
    const newExport = getNewExport(statement, objectExports);
    if (newExport) {
      acc.push(newExport);
      return acc;
    }

    // include unknown statements
    acc.push(statement);
    return acc;
  }, []);

  upgradeDeprecatedTypes(file);
  importHelper.removeDeprecatedStoryImport();
  removeUnusedTemplates(csf);

  let output = printCsf(csf).code;

  try {
    output = await prettier.format(output, {
      ...(await prettier.resolveConfig(info.path)),
      filepath: info.path,
    });
  } catch (e) {
    logger.log(`Failed applying prettier to ${info.path}.`);
  }

  return output;
}

class StorybookImportHelper {
  constructor(file: BabelFile, info: FileInfo) {
    this.sbImportDeclarations = this.getAllSbImportDeclarations(file);
  }

  private sbImportDeclarations: NodePath<t.ImportDeclaration>[];

  private getAllSbImportDeclarations = (file: BabelFile) => {
    const found: NodePath<t.ImportDeclaration>[] = [];

    file.path.traverse({
      ImportDeclaration: (path) => {
        const source = path.node.source.value;

        if (source.startsWith('@storybook/csf') || !source.startsWith('@storybook')) {
          return;
        }
        const isRendererImport = path.get('specifiers').some((specifier) => {
          if (specifier.isImportNamespaceSpecifier()) {
            // throw path.buildCodeFrameError(
            //   `This codemod does not support namespace imports for a ${path.node.source.value} package.\n` +
            //     'Replace the namespace import with named imports and try again.'
            // );
            throw new Error(
              `This codemod does not support namespace imports for a ${path.node.source.value} package.\n` +
                'Replace the namespace import with named imports and try again.'
            );
          }

          if (!specifier.isImportSpecifier()) {
            return false;
          }
          const imported = specifier.get('imported');

          if (Array.isArray(imported)) {
            return imported.some((importedSpecifier) => {
              if (!importedSpecifier.isIdentifier()) {
                return false;
              }
              return [
                'Story',
                'StoryFn',
                'StoryObj',
                'Meta',
                'ComponentStory',
                'ComponentStoryFn',
                'ComponentStoryObj',
                'ComponentMeta',
              ].includes(importedSpecifier.node.name);
            });
          }

          if (!imported.isIdentifier()) {
            return false;
          }
          return [
            'Story',
            'StoryFn',
            'StoryObj',
            'Meta',
            'ComponentStory',
            'ComponentStoryFn',
            'ComponentStoryObj',
            'ComponentMeta',
          ].includes(imported.node.name);
        });

        if (isRendererImport) {
          found.push(path);
        }
      },
    });
    return found;
  };

  getOrAddImport = (type: string): string | undefined => {
    // prefer type import
    const sbImport =
      this.sbImportDeclarations.find((path) => path.node.importKind === 'type') ??
      this.sbImportDeclarations[0];

    if (sbImport == null) {
      return undefined;
    }

    const specifiers = sbImport.get('specifiers');
    const importSpecifier = specifiers.find((specifier) => {
      if (!specifier.isImportSpecifier()) {
        return false;
      }
      const imported = specifier.get('imported');

      if (!imported.isIdentifier()) {
        return false;
      }
      return imported.node.name === type;
    });

    if (importSpecifier) {
      return importSpecifier.node.local.name;
    }
    specifiers[0].insertBefore(t.importSpecifier(t.identifier(type), t.identifier(type)));
    return type;
  };

  removeDeprecatedStoryImport = () => {
    const specifiers = this.sbImportDeclarations.flatMap((it) => it.get('specifiers'));
    const storyImports = specifiers.filter((specifier) => {
      if (!specifier.isImportSpecifier()) {
        return false;
      }
      const imported = specifier.get('imported');

      if (!imported.isIdentifier()) {
        return false;
      }
      return imported.node.name === 'Story';
    });
    storyImports.forEach((path) => path.remove());
  };

  getAllLocalImports = () => {
    return this.sbImportDeclarations
      .flatMap((it) => it.get('specifiers'))
      .map((it) => it.node.local.name);
  };

  updateTypeTo = (id: t.LVal, type: string): t.LVal => {
    if (
      isIdentifier(id) &&
      isTSTypeAnnotation(id.typeAnnotation) &&
      isTSTypeReference(id.typeAnnotation.typeAnnotation) &&
      isIdentifier(id.typeAnnotation.typeAnnotation.typeName)
    ) {
      const { name } = id.typeAnnotation.typeAnnotation.typeName;
      if (this.getAllLocalImports().includes(name)) {
        const localTypeImport = this.getOrAddImport(type);
        return {
          ...id,
          typeAnnotation: t.tsTypeAnnotation(
            t.tsTypeReference(
              t.identifier(localTypeImport ?? ''),
              id.typeAnnotation.typeAnnotation.typeParameters
            )
          ),
        };
      }
    }
    return id;
  };
}

export const parser = 'tsx';
