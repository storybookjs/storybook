import {
  type CsfFile,
  type ESTree as E,
  type ESTreeNode as Node,
  type SourceEditor,
  loadCsf,
  printCsf,
  walk,
} from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import type { API, FileInfo } from 'jscodeshift';
import prettier from 'prettier';
import invariant from 'tiny-invariant';

import { upgradeDeprecatedTypes } from './upgrade-deprecated-types.ts';

const renameAnnotation = (annotation: string) => {
  return annotation === 'storyName' ? 'name' : annotation;
};

const getTemplateBindVariable = (init: Node) =>
  init.type === 'CallExpression' &&
  init.callee.type === 'MemberExpression' &&
  init.callee.object.type === 'Identifier' &&
  init.callee.property.type === 'Identifier' &&
  init.callee.property.name === 'bind' &&
  (init.arguments.length === 0 ||
    (init.arguments.length === 1 &&
      init.arguments[0].type === 'ObjectExpression' &&
      init.arguments[0].properties.length === 0))
    ? init.callee.object.name
    : null;

// export const A = ...
// A.parameters = { ... }; <===
const isStoryAnnotation = (stmt: Node, objectExports: Set<string>) =>
  stmt.type === 'ExpressionStatement' &&
  stmt.expression.type === 'AssignmentExpression' &&
  stmt.expression.left.type === 'MemberExpression' &&
  stmt.expression.left.object.type === 'Identifier' &&
  objectExports.has(stmt.expression.left.object.name);

const isSingleConstExport = (stmt: Node | undefined) =>
  stmt?.type === 'ExportNamedDeclaration' &&
  stmt.declaration?.type === 'VariableDeclaration' &&
  stmt.declaration.declarations.length === 1;

// Remove render function when it matches the global render function in react
// export default { component: Cat };
// export const A = (args) => <Cat {...args} />;
const isReactGlobalRenderFn = (csf: CsfFile, storyFn: Node | undefined) => {
  if (
    csf._meta?.component &&
    storyFn?.type === 'ArrowFunctionExpression' &&
    storyFn.params.length === 1 &&
    storyFn.body.type === 'JSXElement'
  ) {
    const { openingElement } = storyFn.body;
    if (
      openingElement.selfClosing &&
      openingElement.name.type === 'JSXIdentifier' &&
      openingElement.attributes.length === 1
    ) {
      const attr = openingElement.attributes[0];
      const param = storyFn.params[0];
      if (
        attr.type === 'JSXSpreadAttribute' &&
        attr.argument.type === 'Identifier' &&
        param.type === 'Identifier' &&
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
const isSimpleCSFStory = (init: Node, annotations: string[]) =>
  annotations.length === 0 && init.type === 'ArrowFunctionExpression' && init.params.length === 0;

function removeUnusedTemplates(editor: SourceEditor, templates: string[]) {
  templates.forEach((template) => {
    const references: { node: Node; parent: Node | null }[] = [];
    walk(editor.program, (node, parent) => {
      if (node.type === 'Identifier' && node.name === template) {
        references.push({ node, parent });
      }
    });
    // if there is only one reference and this reference is the variable declaration initializing the template
    // then we are sure the template is unused
    const [reference] = references;
    if (
      references.length !== 1 ||
      reference.parent?.type !== 'VariableDeclarator' ||
      reference.parent.id !== reference.node ||
      !reference.parent.init
    ) {
      return;
    }
    const declarator = reference.parent;
    const declaration = editor.parentOf(declarator) as E.VariableDeclaration;
    const { declarations } = declaration;
    const index = declarations.indexOf(declarator);
    if (declarations.length === 1) {
      editor.edits.remove(declaration.start, declaration.end);
    } else if (index < declarations.length - 1) {
      editor.edits.remove(declarator.start, declarations[index + 1].start);
    } else {
      editor.edits.remove(declarations[index - 1].end, declarator.end);
    }
  });
  editor.commit();
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

  const editor = csf._editor;
  const importHelper = new StorybookImportHelper(editor);

  const objectExports = new Set<string>();
  Object.entries(csf._storyExports).forEach(([key, decl]) => {
    const annotations = Object.entries(csf._storyAnnotations[key]).map(
      ([annotation, val]) => `${renameAnnotation(annotation)}: ${editor.source(val)}`
    );

    if (decl.type !== 'VariableDeclarator') {
      return;
    }
    const { init, id } = decl;
    invariant(init, 'Inital value should be declared');
    // only replace arrow function expressions && template
    const template = getTemplateBindVariable(init);

    if (init.type !== 'ArrowFunctionExpression' && !template) {
      return;
    }
    objectExports.add(key);
    const replaceExport = isSingleConstExport(csf._storyStatements[key]);

    // Do change the type of no-arg stories without annotations to StoryFn when applicable
    if (isSimpleCSFStory(init, annotations)) {
      importHelper.updateTypeTo(id, 'StoryFn', replaceExport);
      return;
    }
    importHelper.updateTypeTo(id, 'StoryObj', replaceExport);
    if (!replaceExport) {
      return;
    }

    // Remove the render function when we can hoist the template
    // const Template = (args) => <Cat {...args} />;
    // export const A = Template.bind({});
    const renderAnnotation = isReactGlobalRenderFn(csf, template ? csf._templates[template] : init)
      ? []
      : [`render: ${template ?? editor.source(init)}`];

    const properties = [...renderAnnotation, ...annotations];
    editor.edits.overwrite(
      init.start,
      init.end,
      properties.length === 0 ? '{}' : `{\n${properties.map((it) => `  ${it},\n`).join('')}}`
    );
  });

  // remove story annotations
  for (const statement of editor.program.body) {
    if (isStoryAnnotation(statement, objectExports)) {
      editor.edits.remove(statement.start, statement.end);
    }
  }
  editor.commit();

  upgradeDeprecatedTypes(editor);
  removeUnusedTemplates(editor, Object.keys(csf._templates));

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

const storyTypes = [
  'Story',
  'StoryFn',
  'StoryObj',
  'Meta',
  'ComponentStory',
  'ComponentStoryFn',
  'ComponentStoryObj',
  'ComponentMeta',
];

class StorybookImportHelper {
  private sbImportDeclarations: E.ImportDeclaration[];

  private addedImports: string[] = [];

  constructor(private editor: SourceEditor) {
    this.sbImportDeclarations = editor.program.body.filter(
      (statement): statement is E.ImportDeclaration => {
        if (statement.type !== 'ImportDeclaration') {
          return false;
        }
        const source = statement.source.value;
        if (source.startsWith('@storybook/csf') || !source.startsWith('@storybook')) {
          return false;
        }
        return statement.specifiers.some((specifier) => {
          if (specifier.type === 'ImportNamespaceSpecifier') {
            throw new Error(
              `This codemod does not support namespace imports for a ${source} package.\n` +
                'Replace the namespace import with named imports and try again.'
            );
          }
          return (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.type === 'Identifier' &&
            storyTypes.includes(specifier.imported.name)
          );
        });
      }
    );
  }

  getOrAddImport = (type: string): string | undefined => {
    // prefer type import
    const sbImport =
      this.sbImportDeclarations.find((it) => it.importKind === 'type') ??
      this.sbImportDeclarations[0];

    if (sbImport == null) {
      return undefined;
    }

    const importSpecifier = sbImport.specifiers.find(
      (specifier) =>
        specifier.type === 'ImportSpecifier' &&
        specifier.imported.type === 'Identifier' &&
        specifier.imported.name === type
    );

    if (importSpecifier) {
      return importSpecifier.local.name;
    }
    if (!this.addedImports.includes(type)) {
      this.addedImports.push(type);
      this.editor.edits.appendLeft(sbImport.specifiers[0].start, `${type}, `);
    }
    return type;
  };

  getAllLocalImports = () => {
    return [
      ...this.sbImportDeclarations.flatMap((it) => it.specifiers).map((it) => it.local.name),
      ...this.addedImports,
    ];
  };

  updateTypeTo = (id: E.BindingPattern, type: string, apply: boolean) => {
    if (id.type !== 'Identifier') {
      return;
    }
    const annotation = (id as { typeAnnotation?: E.TSTypeAnnotation | null }).typeAnnotation
      ?.typeAnnotation;
    if (
      annotation?.type === 'TSTypeReference' &&
      annotation.typeName.type === 'Identifier' &&
      this.getAllLocalImports().includes(annotation.typeName.name)
    ) {
      const localTypeImport = this.getOrAddImport(type);
      if (apply) {
        const { typeName } = annotation;
        this.editor.edits.overwrite(typeName.start, typeName.end, localTypeImport ?? '');
      }
    }
  };
}

export const parser = 'tsx';
