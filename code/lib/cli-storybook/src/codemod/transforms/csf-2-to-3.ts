import { formatExistingFile } from 'storybook/internal/common';
import {
  type Binding,
  type CsfFile,
  type ESTree as E,
  type ESTreeNode as Node,
  type SourceEditor,
  declaratorList,
  loadCsf,
  placeableTextOf,
  printCsf,
  printMembers,
  removeFromList,
  removeStatement,
  statementSpan,
  walk,
} from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import invariant from 'tiny-invariant';

import type { FileInfo } from '../../automigrate/codemod.ts';
import { upgradeDeprecatedTypes } from './upgrade-deprecated-types.ts';

const renameAnnotation = (annotation: string) => {
  return annotation === 'storyName' ? 'name' : annotation;
};

// `Story.story = { parameters }` is one assignment. The fields inside it are the annotations.
const annotationProperties = (annotations: Record<string, Node>) => {
  const fields = new Map<string, Node>();
  for (const [annotation, value] of Object.entries(annotations)) {
    if (annotation === 'story' && value.type === 'ObjectExpression') {
      for (const prop of value.properties) {
        if (prop.type === 'Property' && prop.key.type === 'Identifier') {
          fields.set(prop.key.name, prop.value);
        }
      }
      continue;
    }
    fields.set(annotation, value);
  }
  return [...fields].map(
    ([annotation, value]) => `${renameAnnotation(annotation)}: ${placeableTextOf(value)}`
  );
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
    // The render of the meta would replace the removed function, and it is not the default one.
    !csf._metaAnnotations.render &&
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

const MOVABLE_KINDS = new Set<Binding['kind']>(['var', 'let', 'const', 'class', 'function']);
const MOVABLE_DECLARATIONS = new Set([
  'VariableDeclaration',
  'ClassDeclaration',
  'FunctionDeclaration',
]);

const isDeclaration = (statement: Node) =>
  MOVABLE_DECLARATIONS.has(
    (statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement)?.type ?? ''
  );

// The top-level declarations below a story that its annotations read as the file loads,
// transitively. Undefined when one cannot move above the story, such as a story or a reassigned
// variable, or when a statement left between them, such as `defaultArgs.age = 2`, reads one.
const eagerDependencies = (csf: CsfFile, key: string): Node[] | undefined => {
  const { program, scopes } = csf.editor;
  const story = csf._storyStatements[key];
  const annotations = Object.values(csf._storyAnnotations[key]);
  const stories = new Set(Object.values(csf._storyStatements));
  const storyNames = new Set(Object.keys(csf._storyExports));
  const statementOf = (binding: Binding) =>
    program.body.find((it) => it.start <= binding.node.start && binding.node.end <= it.end);
  // `lazy` skips function bodies: an annotation's own run later, but it may call a moved one, as
  // in `args: makeArgs()`.
  const reads = (root: Node, lazy: boolean) => {
    const bindings: Binding[] = [];
    walk(root, (node) => {
      if (lazy && (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression')) {
        return false;
      }
      const binding = scopes.bindingOf(node);
      if (binding?.scope === scopes.program && MOVABLE_KINDS.has(binding.kind)) {
        bindings.push(binding);
      }
    });
    return bindings;
  };

  const moved = new Set<Node>();
  const queue = [...annotations];
  for (const root of queue) {
    for (const binding of reads(root, !moved.has(root))) {
      const statement = statementOf(binding);
      if (!statement || statement.start < story.start || moved.has(statement)) {
        continue;
      }
      if (stories.has(statement) || !binding.constant || !isDeclaration(statement)) {
        return undefined;
      }
      moved.add(statement);
      queue.push(statement);
    }
  }
  const end = Math.max(...annotations.map((it) => it.end));
  const isChangedBelow = program.body.some(
    (it) =>
      story.start < it.start &&
      it.start < end &&
      !isDeclaration(it) &&
      !isStoryAnnotation(it, storyNames) &&
      reads(it, true).some((binding) => moved.has(statementOf(binding)!))
  );
  return isChangedBelow ? undefined : [...moved].sort((a, b) => a.start - b.start);
};

// A simple CSF story is a no-arg story without any extra annotations (params, args, etc.)
const isSimpleCSFStory = (init: Node, annotations: string[]) =>
  annotations.length === 0 && init.type === 'ArrowFunctionExpression' && init.params.length === 0;

// `(() => ({ x }))()`, with or without the parentheses.
const isCalledRightAway = (editor: SourceEditor, fn: Node) => {
  let callee: Node = fn;
  let parent = editor.parentOf(fn);
  while (parent?.type === 'ParenthesizedExpression') {
    callee = parent;
    parent = editor.parentOf(parent);
  }
  return (
    (parent?.type === 'CallExpression' || parent?.type === 'NewExpression') &&
    parent.callee === callee
  );
};

// `A.args = { x }` can follow `const x`, and `const x` can follow `export const A`. Moving those
// args into the story would read `x` before it is initialized, unless `const x` is one of the
// `moved` declarations that go above the story with them.
const readsLaterBinding = (
  editor: SourceEditor,
  story: Node,
  annotations: Node[],
  moved: Node[] = []
) => {
  const later = new Set<string>();
  for (const statement of editor.program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (statement.start < story.end || moved.includes(statement)) {
      continue;
    }
    if (declaration?.type === 'VariableDeclaration') {
      for (const { id } of declaration.declarations) {
        walk(id, (node) => {
          if (node.type === 'Identifier') {
            later.add(node.name);
          }
        });
      }
    } else if (declaration?.type === 'ClassDeclaration' && declaration.id) {
      later.add(declaration.id.name);
    }
  }

  let reads = false;
  for (const annotation of annotations) {
    walk(annotation, (node, parent) => {
      // A function, such as a `play`, only reads its bindings when the story runs, unless it is
      // called right away.
      if (
        (node.type === 'ArrowFunctionExpression' ||
          node.type === 'FunctionExpression' ||
          node.type === 'FunctionDeclaration') &&
        !isCalledRightAway(editor, node)
      ) {
        return false;
      }
      if (node.type !== 'Identifier' || !later.has(node.name)) {
        return;
      }
      // `{ label: 'a' }` and `args.label` name no binding of the file.
      const isName =
        (parent?.type === 'Property' &&
          parent.key === node &&
          !parent.computed &&
          !parent.shorthand) ||
        (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed);
      reads ||= !isName;
    });
  }
  return reads;
};

function removeUnusedTemplates(editor: SourceEditor, templates: string[]) {
  templates.forEach((template) => {
    const references: { node: Node; parent: Node | null }[] = [];
    walk(editor.program, (node, parent) => {
      if ((node.type === 'Identifier' || node.type === 'JSXIdentifier') && node.name === template) {
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
    if (declaration.declarations.length === 1) {
      removeStatement(editor, declaration);
    } else {
      removeFromList(editor, declaratorList(editor, declaration), [declarator]);
    }
  });
  editor.commit();
}

export default async function transform(
  info: FileInfo,
  // For `csf-factories`, which needs `ComponentMeta<T>` to tell that `T` is a component and not args.
  { keepStoryTypes = false }: { keepStoryTypes?: boolean } = {}
) {
  // Svelte CSF files are never CSF 2, but a broad glob can include them
  if (info.path.endsWith('.svelte')) {
    return info.source;
  }
  const makeTitle = (userTitle?: string) => {
    return userTitle || 'FIXME';
  };
  const csf = loadCsf(info.source, { makeTitle, fileName: info.path });

  try {
    csf.parse();
  } catch (err) {
    logger.log(`Error ${err}, skipping`);
    return info.source;
  }

  const editor = csf.editor;
  const importHelper = new StorybookImportHelper(editor);
  // Read before the commit below, after which the stories no longer bind their templates.
  const templates = Object.keys(csf._templates);

  const objectExports = new Set<string>();
  const movedAbove = new Map<Node, Node>();
  Object.entries(csf._storyExports).forEach(([key, decl]) => {
    const annotations = annotationProperties(csf._storyAnnotations[key]);

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
    const isSingle = isSingleConstExport(csf._storyStatements[key]);
    // The annotations move up into the story, so what they read has to be declared above it. The
    // declarations that can move there do, and a story that would still read a later one is kept.
    const dependencies = isSingle ? eagerDependencies(csf, key) : undefined;
    const replaceExport =
      !!dependencies &&
      !readsLaterBinding(editor, decl, Object.values(csf._storyAnnotations[key]), dependencies);
    const updateType = replaceExport && !keepStoryTypes;

    // Do change the type of no-arg stories without annotations to StoryFn when applicable
    if (isSimpleCSFStory(init, annotations)) {
      importHelper.updateTypeTo(id, 'StoryFn', updateType);
      return;
    }
    if (isSingle && !replaceExport) {
      logger.warn(
        `Kept ${key} in ${info.path} as a CSF 2 story, as its annotations read code below it that cannot move above it.`
      );
    }
    importHelper.updateTypeTo(id, 'StoryObj', updateType);
    if (!replaceExport || !dependencies) {
      return;
    }
    objectExports.add(key);
    const statement = csf._storyStatements[key];
    for (const dependency of dependencies) {
      const story = movedAbove.get(dependency);
      if (!story || statement.start < story.start) {
        movedAbove.set(dependency, statement);
      }
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
      printMembers(properties, { indent: editor.indent, trailingComma: true })
    );
  });

  // In source order, so a declaration still follows the ones it reads.
  [...movedAbove]
    .sort(([a], [b]) => a.start - b.start)
    .forEach(([dependency, story]) => {
      editor.edits.appendRight(
        statementSpan(editor, story).start,
        `${editor.source(statementSpan(editor, dependency))}\n`
      );
    });

  for (const statement of editor.program.body) {
    if (isStoryAnnotation(statement, objectExports) || movedAbove.has(statement)) {
      removeStatement(editor, statement);
    }
  }
  editor.commit();

  if (!keepStoryTypes) {
    upgradeDeprecatedTypes(editor);
  }
  removeUnusedTemplates(editor, templates);

  return formatExistingFile(info.path, printCsf(csf).code);
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
      if (apply) {
        const localTypeImport = this.getOrAddImport(type);
        const { typeName } = annotation;
        this.editor.edits.overwrite(typeName.start, typeName.end, localTypeImport ?? '');
      }
    }
  };
}
