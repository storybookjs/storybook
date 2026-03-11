import { types as t, traverse } from 'storybook/internal/babel';
import { isValidPreviewPath, loadCsf, printCsf } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import path from 'path';

import type { FileInfo } from '../../automigrate/codemod';
import { addImportToTop, cleanupTypeImports } from './csf-factories-utils';
import { removeUnusedTypes } from './remove-unused-types';

const typesDisallowList = [
  'Story',
  'StoryFn',
  'StoryObj',
  'Meta',
  'MetaObj',
  'ComponentStory',
  'ComponentMeta',
];

// Name of properties that should not be renamed to `Story.input.xyz`
const reuseDisallowList = ['play', 'run', 'extends', 'story'];

type Options = { previewConfigPath: string; useSubPathImports: boolean };

export async function storyToCsfFactory(
  info: FileInfo,
  { previewConfigPath, useSubPathImports }: Options
) {
  const csf = loadCsf(info.source, { makeTitle: () => 'FIXME' });
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

  /**
   * Add the preview import if it doesn't exist yet:
   *
   * `import preview from '#.storybook/preview'`;
   */
  const programNode = csf._ast.program;
  let previewImport: t.ImportDeclaration | undefined;

  // Check if a root-level constant named 'preview' exists
  const hasRootLevelConfig = programNode.body.some(
    (n) =>
      t.isVariableDeclaration(n) &&
      n.declarations.some((declaration) => t.isIdentifier(declaration.id, { name: 'preview' }))
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

  const sbConfigImportSpecifier = t.importDefaultSpecifier(t.identifier(sbConfigImportName));

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

  programNode.body.forEach((node) => {
    if (t.isImportDeclaration(node)) {
      const importPath = node.source.value;

      // Check if this import is from a .stories file
      // Matches: ./Button.stories, ../components/Card.stories.tsx, etc.
      const isStoryFileImport = /\.stories(\.(ts|tsx|js|jsx|mjs|mts))?$/.test(importPath);

      if (isStoryFileImport) {
        // Collect all imported names from this story file
        node.specifiers.forEach((specifier) => {
          if (t.isImportNamespaceSpecifier(specifier)) {
            // import * as BaseStories from './Button.stories'
            // BaseStories.Primary is a story, so we need: BaseStories.Primary.input
            namespaceStoryImports.add(specifier.local.name);
          } else if (t.isImportSpecifier(specifier)) {
            // import { Primary } from './Button.stories'
            // Primary itself is a story, so we need: Primary.input
            namedStoryImports.add(specifier.local.name);
          } else if (t.isImportDefaultSpecifier(specifier)) {
            // import ButtonStories from './Button.stories'
            // This typically imports the meta, not stories, so we treat it like namespace
            namespaceStoryImports.add(specifier.local.name);
          }
        });
      }
    }

    if (t.isImportDeclaration(node) && isValidPreviewPath(node.source.value)) {
      const defaultImportSpecifier = node.specifiers.find((specifier) =>
        t.isImportDefaultSpecifier(specifier)
      );

      if (!defaultImportSpecifier) {
        node.specifiers.push(sbConfigImportSpecifier);
      } else if (defaultImportSpecifier.local.name !== sbConfigImportName) {
        sbConfigImportName = defaultImportSpecifier.local.name;
      }

      previewImport = node;
    }
  });

  const hasMeta = !!csf._meta;

  // Combined set for quick lookup
  const storyFileImports = new Set([...namespaceStoryImports, ...namedStoryImports]);

  // @TODO: Support unconventional formats:
  // `export function Story() { };` and `export { Story };
  // These are not part of csf._storyExports but rather csf._storyStatements and are tricky to support.
  Object.entries(csf._storyExports).forEach(([exportName, decl]) => {
    const id = decl.id;
    const declarator = decl as t.VariableDeclarator;
    let init = t.isVariableDeclarator(declarator) ? declarator.init : undefined;

    if (t.isIdentifier(id) && init) {
      // Remove type annotations e.g. A<B> in `const Story: A<B> = {};`
      if (id.typeAnnotation) {
        id.typeAnnotation = null;
      }

      // Remove type annotations e.g. A<B> in `const Story = {} satisfies A<B>;`
      if (t.isTSSatisfiesExpression(init) || t.isTSAsExpression(init)) {
        init = init.expression;
      }

      if (t.isObjectExpression(init)) {
        // Wrap the object in `meta.story()`

        declarator.init = t.callExpression(
          t.memberExpression(t.identifier(metaVariableName), t.identifier('story')),
          init.properties.length === 0 ? [] : [init]
        );
        if (t.isIdentifier(id)) {
          transformedStoryExports.add(exportName);
        }
      } else if (t.isArrowFunctionExpression(init)) {
        // Transform CSF1 to meta.story({ render: <originalFn> })
        declarator.init = t.callExpression(
          t.memberExpression(t.identifier(metaVariableName), t.identifier('story')),
          [init]
        );
        if (t.isIdentifier(id)) {
          transformedStoryExports.add(exportName);
        }
      }
    }
  });

  // Support function-declared stories
  Object.entries(csf._storyExports).forEach(([exportName, decl]) => {
    if (t.isFunctionDeclaration(decl) && decl.id) {
      const arrowFn = t.arrowFunctionExpression(decl.params, decl.body);
      arrowFn.async = !!decl.async;

      const wrappedCall = t.callExpression(
        t.memberExpression(t.identifier(metaVariableName), t.identifier('story')),
        [arrowFn]
      );

      const replacement = t.exportNamedDeclaration(
        t.variableDeclaration('const', [
          t.variableDeclarator(t.identifier(exportName), wrappedCall),
        ])
      );

      const pathForExport = (
        csf as unknown as {
          _storyPaths?: Record<string, { replaceWith?: (node: t.Node) => void }>;
        }
      )._storyPaths?.[exportName];
      if (pathForExport && pathForExport.replaceWith) {
        pathForExport.replaceWith(replacement);
        transformedStoryExports.add(exportName);
      }
    }
  });

  const storyExportDecls = new Map(
    Object.entries(csf._storyExports).filter(
      (
        entry
      ): entry is [string, Exclude<(typeof csf._storyExports)[string], t.FunctionDeclaration>] =>
        !t.isFunctionDeclaration(entry[1])
    )
  );

  // For each story, replace any reference of story reuse e.g.
  // Story.args -> Story.input.args
  // meta.args -> meta.input.args
  // BaseStories.Primary.args -> BaseStories.Primary.input.args (cross-file)
  traverse(csf._ast, {
    /**
     * Handle SAME-FILE story references.
     *
     * Examples: Primary.args → Primary.input.args meta.args → meta.input.args
     */
    Identifier(nodePath) {
      const identifierName = nodePath.node.name;
      const binding = nodePath.scope.getBinding(identifierName);

      // Check if the identifier corresponds to a story export or the meta variable
      const isStoryExport = binding && storyExportDecls.has(binding.identifier.name);
      const isMetaVariable = identifierName === metaVariableName;

      if (isStoryExport || isMetaVariable) {
        const parent = nodePath.parent;

        // Skip declarations (e.g., `const Story = {};`)
        if (t.isVariableDeclarator(parent) && parent.id === nodePath.node) {
          return;
        }

        // Skip import statements e.g.`import { X as Story }`
        if (t.isImportSpecifier(parent)) {
          return;
        }

        // Skip export statements e.g.`export const Story` or `export { Story }`
        if (t.isExportSpecifier(parent) || t.isExportDefaultDeclaration(parent)) {
          return;
        }

        // Skip if it's already `Story.input` or `meta.input`
        if (t.isMemberExpression(parent) && t.isIdentifier(parent.property, { name: 'input' })) {
          return;
        }

        // Check if the property name is in the disallow list
        if (
          t.isMemberExpression(parent) &&
          t.isIdentifier(parent.property) &&
          reuseDisallowList.includes(parent.property.name)
        ) {
          return;
        }

        try {
          // Replace the identifier with `Story.input` or `meta.input`
          nodePath.replaceWith(
            t.memberExpression(t.identifier(identifierName), t.identifier('input'))
          );
        } catch (err: any) {
          // This error occurs for cross-file references like `Stories.Story.args`
          // which are handled by the MemberExpression visitor below.
          if (err.message.includes(`instead got "MemberExpression"`)) {
            return;
          } else {
            throw err;
          }
        }
      }
    },

    /**
     * Handle CROSS-FILE story references.
     *
     * When we import stories from another file: import * as BaseStories from './Button.stories';
     *
     * And use them like: BaseStories.Primary.args
     *
     * We need to transform to: BaseStories.Primary.input.args
     *
     * Why? Because the imported file will ALSO be transformed to CSF4, where story properties are
     * accessed via `.input`.
     */
    MemberExpression(nodePath) {
      const node = nodePath.node;

      // We're looking for patterns like: BaseStories.Primary.args
      // Which is: MemberExpression { object: MemberExpression { object: Identifier, property }, property }
      //
      // We want to find the inner MemberExpression (BaseStories.Primary)
      // and check if its object (BaseStories) is from a story file import.

      // Check if this is a nested member expression (e.g., BaseStories.Primary.args)
      // We want to transform BaseStories.Primary → BaseStories.Primary.input
      // So we look for MemberExpression where object is also a MemberExpression

      const innerObject = node.object;

      // Check if the object is a MemberExpression like BaseStories.Primary
      if (t.isMemberExpression(innerObject)) {
        const importName = innerObject.object; // BaseStories
        const storyName = innerObject.property; // Primary
        const accessedProperty = node.property; // args

        // Verify: importName is an Identifier that's in our storyFileImports set
        if (
          t.isIdentifier(importName) &&
          storyFileImports.has(importName.name) &&
          t.isIdentifier(storyName)
        ) {
          // Skip if already transformed: BaseStories.Primary.input.args
          // This check prevents infinite loops when the traverser revisits modified nodes
          if (t.isIdentifier(storyName, { name: 'input' })) {
            return;
          }

          // Only process if the accessed property is an Identifier
          if (!t.isIdentifier(accessedProperty)) {
            return;
          }

          // Skip if the current property being accessed is 'input'
          // This means we're looking at something like: BaseStories.Primary.input
          // which was already transformed in a previous iteration
          if (accessedProperty.name === 'input') {
            return;
          }

          // Skip if accessing a property in the disallow list
          if (reuseDisallowList.includes(accessedProperty.name)) {
            return;
          }

          // Transform: BaseStories.Primary.args → BaseStories.Primary.input.args
          // We do this by replacing the inner object (BaseStories.Primary)
          // with (BaseStories.Primary.input)
          nodePath.node.object = t.memberExpression(innerObject, t.identifier('input'));

          // Skip traversing into the newly created node to prevent infinite loops
          nodePath.skip();
        }
      }

      // Handle NAMED IMPORTS: import { Primary } from './Button.stories'
      // Usage: Primary.args → Primary.input.args
      //
      // Pattern: MemberExpression { object: Identifier("Primary"), property: Identifier("args") }
      // Where "Primary" is in our namedStoryImports set (NOT namespace imports)
      if (t.isIdentifier(innerObject) && namedStoryImports.has(innerObject.name)) {
        const accessedProperty = node.property;

        // Only process if the property is an Identifier
        if (!t.isIdentifier(accessedProperty)) {
          return;
        }

        // Skip if this is already accessing .input
        if (accessedProperty.name === 'input') {
          return;
        }

        // Skip if accessing a property in the disallow list
        if (reuseDisallowList.includes(accessedProperty.name)) {
          return;
        }

        // Transform: Primary.args → Primary.input.args
        nodePath.replaceWith(
          t.memberExpression(
            t.memberExpression(innerObject, t.identifier('input')),
            accessedProperty
          )
        );
        nodePath.skip();
        return;
      }

      // Handle NAMESPACE IMPORTS spread: import * as BaseStories from './Button.stories'
      // Usage: ...BaseStories.Secondary → ...BaseStories.Secondary.input
      //
      // Pattern: SpreadElement containing MemberExpression { object: Identifier("BaseStories"), property: Identifier("Secondary") }
      if (t.isIdentifier(innerObject) && namespaceStoryImports.has(innerObject.name)) {
        const storyName = node.property;

        // Skip if this is already .input
        if (t.isIdentifier(storyName, { name: 'input' })) {
          return;
        }

        // Check if parent is a SpreadElement (...BaseStories.Secondary)
        const parent = nodePath.parent;
        if (t.isSpreadElement(parent)) {
          // Transform: ...BaseStories.Secondary → ...BaseStories.Secondary.input
          nodePath.replaceWith(t.memberExpression(node, t.identifier('input')));
          nodePath.skip();
        }
        // Note: For non-spread namespace access like BaseStories.Primary.args,
        // it's handled by the nested MemberExpression case above
      }
    },
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

  // modify meta
  if (csf._metaPath) {
    let declaration = csf._metaPath.node.declaration;
    if (t.isTSSatisfiesExpression(declaration) || t.isTSAsExpression(declaration)) {
      declaration = declaration.expression;
    }

    if (t.isObjectExpression(declaration)) {
      const metaVariable = t.variableDeclaration('const', [
        t.variableDeclarator(
          t.identifier(metaVariableName),
          t.callExpression(
            t.memberExpression(t.identifier(sbConfigImportName), t.identifier('meta')),
            [declaration]
          )
        ),
      ]);
      csf._metaPath.replaceWith(metaVariable);
    } else if (t.isIdentifier(declaration)) {
      /**
       * Transform const declared metas:
       *
       * `const meta = {}; export default meta;`
       *
       * Into a meta call:
       *
       * `const meta = preview.meta({ title: 'A' });`
       */
      const binding = csf._metaPath.scope.getBinding(declaration.name);
      if (binding && binding.path.isVariableDeclarator()) {
        const originalName = declaration.name;

        // Always rename the meta variable to 'meta'
        binding.path.node.id = t.identifier(metaVariableName);

        let init = binding.path.node.init;
        if (t.isTSSatisfiesExpression(init) || t.isTSAsExpression(init)) {
          init = init.expression;
        }
        if (t.isObjectExpression(init)) {
          binding.path.node.init = t.callExpression(
            t.memberExpression(t.identifier(sbConfigImportName), t.identifier('meta')),
            [init]
          );
        }

        // Update all references to the original name
        csf._metaPath.scope.rename(originalName, metaVariableName);
      }

      // Remove the default export, it's not needed anymore
      csf._metaPath.remove();
    }
  }

  if (previewImport) {
    // If there is alerady an import, just update the path. This is useful for users
    // who rerun the codemod to change the preview import to use (or not) subpaths
    if (previewImport.source.value !== previewPath) {
      previewImport.source = t.stringLiteral(previewPath);
    }
  } else if (hasMeta) {
    // If the import doesn't exist, create a new one
    const configImport = t.importDeclaration(
      [t.importDefaultSpecifier(t.identifier(sbConfigImportName))],
      t.stringLiteral(previewPath)
    );
    addImportToTop(programNode, configImport);
  }

  removeUnusedTypes(programNode, csf._ast);

  return printCsf(csf).code;
}
