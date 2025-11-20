import { types as t, traverse } from 'storybook/internal/babel';
import { isValidPreviewPath, loadCsf, printCsf } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import path from 'path';

import type { FileInfo } from '../../automigrate/codemod';
import { cleanupTypeImports } from './csf-factories-utils';
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

  programNode.body.forEach((node) => {
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
  traverse(csf._ast, {
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
          // This is a tough one to support, we just skip for now.
          // Relates to `Stories.Story.args` where Stories is coming from another file. We can't know whether it should be transformed or not.
          if (err.message.includes(`instead got "MemberExpression"`)) {
            return;
          } else {
            throw err;
          }
        }
      }
    },
  });

  // Normalize play access for meta and stories:
  // - meta.input.play(...) -> meta.play(...)
  // - Story.input.play(...) -> Story.play(...)
  traverse(csf._ast, {
    MemberExpression(pathME) {
      const obj = pathME.node.object;
      const prop = pathME.node.property;

      if (!t.isIdentifier(prop, { name: 'play' })) {
        return;
      }

      // meta.input.play -> meta.play

      // meta.input.play -> meta.play
      if (
        t.isMemberExpression(obj) &&
        t.isIdentifier(obj.object) &&
        t.isIdentifier(obj.property, { name: 'input' }) &&
        obj.object.name === metaVariableName
      ) {
        pathME.replaceWith(
          t.memberExpression(t.identifier(metaVariableName), t.identifier('play'))
        );
        return;
      }

      // Story.input.play -> Story.play (only for known story exports)
      if (
        t.isMemberExpression(obj) &&
        t.isIdentifier(obj.object) &&
        t.isIdentifier(obj.property, { name: 'input' })
      ) {
        const storyName = obj.object.name;
        if (storyExportDecls.has(storyName)) {
          pathME.replaceWith(t.memberExpression(t.identifier(storyName), t.identifier('play')));
        }
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
    programNode.body.unshift(configImport);
  }

  removeUnusedTypes(programNode, csf._ast);

  return printCsf(csf).code;
}
