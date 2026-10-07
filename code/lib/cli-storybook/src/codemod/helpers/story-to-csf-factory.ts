import {
  type ESTree as E,
  type ESTreeNode as Node,
  isValidPreviewPath,
  loadCsf,
  printCsf,
  walk,
} from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import path from 'path';

import type { FileInfo } from '../../automigrate/codemod.ts';
import { removeStatements, setImportSpecifiers } from '../../automigrate/helpers/source-edits.ts';
import { addImportToTop } from './csf-factories-utils.ts';
import { customArgsTypes } from './custom-args-type.ts';
import { removeUnusedTypes } from './remove-unused-types.ts';
import { wrapArgsMocks } from './wrap-args-mocks.ts';

// Name of properties that should not be renamed to `Story.input.xyz`
const reuseDisallowList = ['play', 'run', 'extends', 'story'];

const TYPE_CASTS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
]);

// Whether an identifier sits where an expression like `Story.input` could replace it, rather than
// in a binding, a key, a label, or a type.
function isExpressionPosition(node: Node, parent: Node, grandparent: Node | null) {
  switch (parent.type) {
    case 'VariableDeclarator':
      return parent.id !== node;
    case 'ImportSpecifier':
    case 'ImportDefaultSpecifier':
    case 'ImportNamespaceSpecifier':
    case 'ExportSpecifier':
    case 'ExportDefaultDeclaration':
    case 'MetaProperty':
    case 'LabeledStatement':
    case 'BreakStatement':
    case 'ContinueStatement':
    case 'CatchClause':
    case 'ArrayPattern':
    case 'RestElement':
    case 'ClassDeclaration':
    case 'ClassExpression':
      return false;
    case 'AssignmentPattern':
      return parent.right === node;
    case 'MemberExpression':
      return parent.object === node || parent.computed;
    case 'Property':
      return (
        grandparent?.type !== 'ObjectPattern' &&
        (parent.value === node || (parent.computed && parent.key === node))
      );
    case 'MethodDefinition':
    case 'PropertyDefinition':
      return parent.computed && parent.key === node;
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return parent.body === node;
    default:
      return !parent.type.startsWith('TS') || TYPE_CASTS.has(parent.type);
  }
}

const isTypeWrapped = (node: Node): node is E.TSAsExpression | E.TSSatisfiesExpression =>
  node.type === 'TSSatisfiesExpression' || node.type === 'TSAsExpression';

// OXC types declare no annotation on binding identifiers, but TypeScript sources have them.
const typeAnnotationOf = (id: Node) =>
  (id as { typeAnnotation?: E.TSTypeAnnotation | null }).typeAnnotation;

type Options =
  | { useSubPathImports: true; previewConfigPath?: string }
  | { useSubPathImports: false; previewConfigPath: string };

export async function storyToCsfFactory(
  info: FileInfo,
  { previewConfigPath, useSubPathImports }: Options
) {
  let csf;
  try {
    csf = loadCsf(info.source, { makeTitle: () => 'FIXME' });
  } catch {
    logger.log(`Error when parsing ${info.path}, skipping: file could not be parsed`);
    return info.source;
  }
  try {
    csf.parse();
  } catch (err) {
    logger.log(`Error when parsing ${info.path}, skipping:\n${err}`);
    return info.source;
  }

  // Track detected stories and which ones we actually transform
  const detectedStories = csf.stories;
  const detectedStoryNames = detectedStories.map((story) => story.name);
  const transformedStoryExports = new Set<string>();

  const metaVariableName = csf._metaVariableName ?? 'meta';

  const editor = csf._editor;
  const { program, scopes } = editor;
  const quote = editor.quote;
  // Registers every node with its parent, which the reference rewrite below asks for.
  editor.parentOf(program);

  // Check if a root-level constant named 'preview' exists
  const hasRootLevelConfig = program.body.some(
    (n) =>
      n.type === 'VariableDeclaration' &&
      n.declarations.some(
        (declaration) => declaration.id.type === 'Identifier' && declaration.id.name === 'preview'
      )
  );

  let previewPath = '#.storybook/preview';
  if (!useSubPathImports) {
    // calculate relative path from story file to preview file
    const relativePath = path.relative(path.dirname(info.path), previewConfigPath);
    const { dir, name } = path.parse(relativePath);

    // Construct the path manually and replace Windows backslashes
    previewPath = `${dir ? `${dir}/` : ''}${name}`;

    // account for stories in the same path as preview file
    if (!previewPath.startsWith('.')) {
      previewPath = `./${previewPath}`;
    }

    // Convert Windows backslashes to forward slashes
    previewPath = previewPath.replace(/\\/g, '/');
  }

  let sbConfigImportName = hasRootLevelConfig ? 'storybookPreview' : 'preview';
  let previewImport: E.ImportDeclaration | undefined;
  let previewImportNeedsDefault = false;

  /**
   * Collect imports from other .stories files.
   *
   * When we see: import * as BaseStories from './Button.stories'; import { Primary } from
   * './Card.stories';
   *
   * We store the local names ("BaseStories", "Primary") so we can later transform references like
   * `BaseStories.Primary.args` → `BaseStories.Primary.input.args`
   *
   * Why? Because those imported stories will ALSO be transformed to CSF4, so their properties will
   * be under `.input` instead of directly on the object.
   *
   * We track TWO types of imports:
   *
   * - Namespace imports (import * as X): X.Story.args → X.Story.input.args
   * - Named imports (import { Story }): Story.args → Story.input.args
   */
  const namespaceStoryImports = new Set<string>(); // import * as X
  const namedStoryImports = new Set<string>(); // import { X } or import X

  program.body.forEach((node) => {
    if (node.type !== 'ImportDeclaration') {
      return;
    }
    const importPath = node.source.value;

    // Matches: ./Button.stories, ../components/Card.stories.tsx, etc.
    if (/\.stories(\.(ts|tsx|js|jsx|mjs|mts))?$/.test(importPath)) {
      node.specifiers.forEach((specifier) => {
        if (specifier.type === 'ImportSpecifier') {
          // import { Primary } from './Button.stories': Primary itself is a story
          namedStoryImports.add(specifier.local.name);
        } else {
          // import * as BaseStories from './Button.stories': BaseStories.Primary is a story.
          // A default import typically imports the meta, so it is treated like a namespace.
          namespaceStoryImports.add(specifier.local.name);
        }
      });
    }

    if (isValidPreviewPath(importPath)) {
      const defaultImportSpecifier = node.specifiers.find(
        (specifier) => specifier.type === 'ImportDefaultSpecifier'
      );

      if (!defaultImportSpecifier) {
        previewImportNeedsDefault = true;
      } else if (defaultImportSpecifier.local.name !== sbConfigImportName) {
        sbConfigImportName = defaultImportSpecifier.local.name;
      }

      previewImport = node;
    }
  });

  const hasMeta = !!csf._meta;

  const customArgs = customArgsTypes(editor, csf._metaAnnotations.component);
  const metaArgsTypes: E.TSType[] = [];
  const storyInits: { init: E.Expression; story: E.Expression; argsTypes: E.TSType[] }[] = [];
  const functionStories: { statement: Node; fn: E.Function }[] = [];

  // Combined set for quick lookup
  const storyFileImports = new Set([...namespaceStoryImports, ...namedStoryImports]);

  // @TODO: Support unconventional formats:
  // `export function Story() { };` and `export { Story };
  // These are not part of csf._storyExports but rather csf._storyStatements and are tricky to support.
  Object.entries(csf._storyExports).forEach(([exportName, decl]) => {
    if (decl.type === 'FunctionDeclaration') {
      const statement = csf._storyStatements[exportName];
      if (decl.id && statement?.type === 'ExportNamedDeclaration') {
        functionStories.push({ statement, fn: decl });
        transformedStoryExports.add(exportName);
      }
      return;
    }
    if (decl.type !== 'VariableDeclarator' || decl.id.type !== 'Identifier' || !decl.init) {
      return;
    }
    const argsTypes: E.TSType[] = [];

    // Remove type annotations e.g. A<B> in `const Story: A<B> = {};`
    const typeAnnotation = typeAnnotationOf(decl.id);
    if (typeAnnotation) {
      argsTypes.push(...customArgs.read(typeAnnotation));
      editor.edits.remove(typeAnnotation.start, typeAnnotation.end);
    }

    // Remove type annotations e.g. A<B> in `const Story = {} satisfies A<B>;`
    let story: E.Expression = decl.init;
    if (isTypeWrapped(story)) {
      argsTypes.push(...customArgs.read(story.typeAnnotation));
      story = story.expression;
    }

    if (story.type === 'ObjectExpression' || story.type === 'ArrowFunctionExpression') {
      storyInits.push({ init: decl.init, story, argsTypes });
      transformedStoryExports.add(exportName);
    }
  });

  // If no stories were transformed, bail early to avoid having a mixed CSF syntax and therefore a broken indexer.
  if (transformedStoryExports.size === 0) {
    logger.warn(
      `Skipping codemod for ${info.path}: no stories were transformed. Either there are no stories, file has been already transformed or some stories are written in an unsupported format.`
    );
    return info.source;
  }

  // If some stories were detected but not all could be transformed, we skip the codemod to avoid mixed csf syntax and therefore a broken indexer.
  if (detectedStoryNames.length > 0 && transformedStoryExports.size !== detectedStoryNames.length) {
    logger.warn(
      `Skipping codemod for ${info.path}:\nSome of the detected stories [${detectedStoryNames
        .map((name) => `"${name}"`)
        .join(', ')}] would not be transformed because they are written in an unsupported format.`
    );
    return info.source;
  }

  const storyExportNames = new Set(
    Object.entries(csf._storyExports)
      .filter(([, decl]) => decl.type !== 'FunctionDeclaration')
      .map(([name]) => name)
  );

  const isIdentifierNamed = (node: Node, names: Set<string>): node is E.IdentifierReference =>
    node.type === 'Identifier' && names.has(node.name);
  const isAllowedAccess = (property: Node) =>
    property.type === 'Identifier' &&
    property.name !== 'input' &&
    !reuseDisallowList.includes(property.name);

  // For each story, replace any reference of story reuse e.g.
  // Story.args -> Story.input.args
  // meta.args -> meta.input.args
  // BaseStories.Primary.args -> BaseStories.Primary.input.args (cross-file)
  walk(program, (node, parent) => {
    if (node.type === 'MemberExpression') {
      const innerObject = node.object;

      // Cross-file namespace access: BaseStories.Primary.args → BaseStories.Primary.input.args
      if (
        innerObject.type === 'MemberExpression' &&
        isIdentifierNamed(innerObject.object, storyFileImports) &&
        innerObject.property.type === 'Identifier'
      ) {
        if (innerObject.property.name === 'input' || !isAllowedAccess(node.property)) {
          return;
        }
        editor.edits.appendLeft(innerObject.end, '.input');
        return false;
      }

      // Named story imports: Primary.args → Primary.input.args
      if (isIdentifierNamed(innerObject, namedStoryImports)) {
        if (!isAllowedAccess(node.property)) {
          return;
        }
        editor.edits.appendLeft(innerObject.end, '.input');
        return false;
      }

      // Namespace spreads: ...BaseStories.Secondary → ...BaseStories.Secondary.input
      if (
        isIdentifierNamed(innerObject, namespaceStoryImports) &&
        !(node.property.type === 'Identifier' && node.property.name === 'input') &&
        parent?.type === 'SpreadElement'
      ) {
        editor.edits.appendLeft(node.end, '.input');
        return false;
      }
      return;
    }

    // Same-file story references: Primary.args → Primary.input.args, meta.args → meta.input.args
    if (node.type !== 'Identifier' || !parent) {
      return;
    }
    const isStoryExport = storyExportNames.has(node.name) && !!scopes.bindingOf(node);
    if (!isStoryExport && node.name !== metaVariableName) {
      return;
    }
    if (
      parent.type === 'MemberExpression' &&
      parent.property.type === 'Identifier' &&
      (parent.property.name === 'input' || reuseDisallowList.includes(parent.property.name))
    ) {
      return;
    }
    if (!isExpressionPosition(node, parent, editor.parentOf(parent))) {
      return;
    }
    if (parent.type === 'Property' && parent.shorthand) {
      editor.edits.overwrite(parent.start, parent.end, `${node.name}: ${node.name}.input`);
    } else {
      editor.edits.appendLeft(node.end, '.input');
    }
  });

  // A custom args type that every story has is written once, on the meta.
  const sharedArgsTypes =
    storyInits.length === transformedStoryExports.size
      ? customArgs.shared(storyInits.map(({ argsTypes }) => argsTypes))
      : [];

  // Wraps `inner` in `before…after`, dropping the type cast of `outer` around it.
  const wrap = (outer: Node, inner: Node, before: string, after: string) => {
    if (inner.end < outer.end) {
      editor.edits.remove(inner.end, outer.end);
    }
    editor.edits.appendRight(inner.start, before);
    editor.edits.appendLeft(inner.end, after);
  };

  // modify meta
  const metaExport = program.body.find(
    (node): node is E.ExportDefaultDeclaration => node.type === 'ExportDefaultDeclaration'
  );
  if (hasMeta && metaExport) {
    const previewMeta = () =>
      `${customArgs.typed(sbConfigImportName, [...metaArgsTypes, ...sharedArgsTypes])}.meta(`;

    let declaration = metaExport.declaration as Node;
    if (isTypeWrapped(declaration)) {
      metaArgsTypes.push(...customArgs.read(declaration.typeAnnotation));
      declaration = declaration.expression;
    }

    if (declaration.type === 'ObjectExpression') {
      editor.edits.overwrite(
        metaExport.start,
        declaration.start,
        `const ${metaVariableName} = ${previewMeta()}`
      );
      if (declaration.end < metaExport.end) {
        editor.edits.overwrite(declaration.end, metaExport.end, ');');
      } else {
        editor.edits.appendLeft(declaration.end, ');');
      }
    } else if (declaration.type === 'Identifier') {
      /**
       * Transform const declared metas:
       *
       * `const meta = {}; export default meta;`
       *
       * Into a meta call:
       *
       * `const meta = preview.meta({ title: 'A' });`
       */
      const binding = scopes.program.bindings.get(declaration.name);
      if (binding?.node.type === 'VariableDeclarator') {
        const declarator = binding.node;
        const typeAnnotation = typeAnnotationOf(declarator.id);
        if (typeAnnotation) {
          metaArgsTypes.push(...customArgs.read(typeAnnotation));
          editor.edits.remove(typeAnnotation.start, typeAnnotation.end);
        }

        let init = declarator.init as Node | null;
        if (init && isTypeWrapped(init)) {
          metaArgsTypes.push(...customArgs.read(init.typeAnnotation));
          init = init.expression;
        }
        if (init?.type === 'ObjectExpression') {
          wrap(declarator.init!, init, previewMeta(), ')');
        }
      }

      // Remove the default export, it's not needed anymore
      removeStatements(editor, new Set([metaExport]));
    }
  }

  for (const { init, story, argsTypes } of storyInits) {
    const callee = `${customArgs.typed(metaVariableName, argsTypes, [
      ...metaArgsTypes,
      ...sharedArgsTypes,
    ])}.story`;
    if (story.type === 'ObjectExpression' && story.properties.length === 0) {
      editor.edits.overwrite(init.start, init.end, `${callee}()`);
    } else {
      wrap(init, story, `${callee}(`, ')');
    }
  }

  for (const { statement, fn } of functionStories) {
    const params = fn.params.map((param) => editor.source(param)).join(', ');
    editor.edits.overwrite(
      statement.start,
      fn.body!.start,
      `export const ${fn.id!.name} = ${metaVariableName}.story(${fn.async ? 'async ' : ''}(${params}) => `
    );
    editor.edits.appendLeft(fn.body!.end, ');');
  }

  if (previewImport) {
    if (previewImportNeedsDefault) {
      setImportSpecifiers(editor, previewImport, previewImport.specifiers, {
        default: sbConfigImportName,
      });
    }
    // If there is already an import, just update the path. This is useful for users
    // who rerun the codemod to change the preview import to use (or not) subpaths
    if (previewImport.source.value !== previewPath) {
      editor.edits.overwrite(
        previewImport.source.start,
        previewImport.source.end,
        `${quote}${previewPath}${quote}`
      );
    }
  } else if (hasMeta) {
    addImportToTop(editor, `import ${sbConfigImportName} from ${quote}${previewPath}${quote};`);
  }

  editor.commit();
  wrapArgsMocks(editor);
  editor.commit();
  removeUnusedTypes(editor);

  return printCsf(csf).code;
}
