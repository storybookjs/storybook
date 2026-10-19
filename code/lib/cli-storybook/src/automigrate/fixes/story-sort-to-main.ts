import { HandledError } from 'storybook/internal/common';
import { traverse, types as t } from 'storybook/internal/babel';
import { type CsfObject, type CsfValue, loadConfig } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import type { Fix } from '../types.ts';

type Sorter =
  | { kind: 'value'; value: readonly CsfValue[] | { readonly [key: string]: CsfValue } }
  | { kind: 'comparator'; node: t.Expression };

interface StorySortToMainOptions {
  sorter: Sorter | undefined;
  // Why the migration refuses to touch either file; the main hook fails before writing.
  previewProblem?: string;
  // The comparator was found in the named parameters export rather than the default export.
  namedOwner?: boolean;
  // The runtime ignores this comparator until the migration activates it with the user's consent.
  shadowed?: boolean;
}

const storySortPath = ['parameters', 'options', 'storySort'];

const movableGlobals = new Set(['undefined', 'NaN', 'Infinity']);

const movableFunction = (node: t.Expression | undefined): t.Expression | undefined => {
  if (!t.isArrowFunctionExpression(node) && !t.isFunctionExpression(node)) {
    return undefined;
  }
  // Binding facts need real scopes, so traverse a synthetic module around the detached node.
  let movable = true;
  traverse(t.file(t.program([t.expressionStatement(t.cloneNode(node, true))])), {
    Program(program) {
      program.stop();
      program.scope.crawl();
      const body = program.get('body');
      const statementPath = (Array.isArray(body) ? body : [body])[0];
      if (!statementPath.isExpressionStatement()) {
        return;
      }
      const expressionPath = statementPath.get('expression');
      expressionPath.traverse({
        'TSTypeAnnotation|TSTypeParameterDeclaration|TSTypeParameterInstantiation': (typePath) =>
          typePath.skip(),
        ReferencedIdentifier(reference) {
          if (
            !reference.scope.getBinding(reference.node.name) &&
            !movableGlobals.has(reference.node.name)
          ) {
            movable = false;
            reference.stop();
          }
        },
      });
    },
  });
  return movable ? node : undefined;
};

function fail(reason: string): never {
  throw new HandledError(
    `Cannot automigrate storySort: ${reason}. Storybook no longer reads parameters.options.storySort from the preview. Move it to storySorts in the main config manually and remove the preview property. Note that a comparator moved to the main config runs in Node during story indexing.`
  );
}

const readSorter = (object: CsfObject | undefined, path: readonly string[]): Sorter | undefined => {
  if (!object) {
    return undefined;
  }
  const value = object.getValue(path);
  if (value !== null && typeof value === 'object') {
    return { kind: 'value', value };
  }
  const comparator = movableFunction(object.get(path));
  return comparator ? { kind: 'comparator', node: comparator } : undefined;
};

export const storySortToMain: Fix<StorySortToMainOptions> = {
  id: 'story-sort-to-main',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#storysort-in-the-preview-replaced-by-storysorts-in-main',

  async check({ files, previewConfigPath }) {
    if (!previewConfigPath) {
      return null;
    }
    const source = await files.read(previewConfigPath);
    if (!source.includes('storySort')) {
      return null;
    }
    const preview = loadConfig(source, previewConfigPath).parse();
    // Without a default root (ESM default export or `module.exports`), the base editor resolves
    // against the named exports, so only read the default view when one actually exists.
    const defaultSorter = preview._exportsObject ? readSorter(preview, storySortPath) : undefined;
    const named = preview.namedExport('parameters');
    const namedSorter = readSorter(named, storySortPath);
    if (defaultSorter && namedSorter) {
      return {
        sorter: undefined,
        previewProblem: 'both the default and the named parameters export define storySort',
      };
    }
    const sorter = defaultSorter ?? namedSorter;
    const namedOwner = Boolean(namedSorter);
    const beforeParameters = preview.mutationDiagnostics.length;
    const defaultParameters = preview.hasDefaultExport ? preview.get(['parameters']) : undefined;
    const parametersBlocked =
      defaultParameters === undefined && preview.mutationDiagnostics.length > beforeParameters;
    // A nullish default field lets the named export through (`default[field] ?? named[field]`);
    // anything else the default export defines — or cannot resolve — hides the named comparator.
    const shadowed =
      namedOwner &&
      preview.hasDefaultExport &&
      (parametersBlocked ||
        (defaultParameters !== undefined &&
          !t.isNullLiteral(defaultParameters) &&
          !t.isIdentifier(defaultParameters, { name: 'undefined' })));
    const namedEditor = namedOwner ? preview.namedExport('parameters', 'mutate') : undefined;
    const removal = namedEditor ? namedEditor.remove(storySortPath) : preview.remove(storySortPath);
    return {
      sorter,
      namedOwner,
      shadowed,
      previewProblem: removal.ok ? undefined : removal.diagnostic.message,
    };
  },

  prompt: (result) =>
    result?.shadowed
      ? `Move ${picocolors.cyan('parameters.options.storySort')} from the named preview export to ${picocolors.cyan('storySorts')} in main? Storybook ignores it today because the default export defines parameters, so migrating it activates a sort that has not run and changes the story order.`
      : `Move ${picocolors.cyan('parameters.options.storySort')} from preview to ${picocolors.cyan('storySorts')} in main?`,

  transform: ({ result: { sorter, previewProblem, namedOwner, shadowed }, yes }) => [
    {
      filter: { kind: ['main'] },
      editConfig: (main) => {
        if (previewProblem) {
          fail(previewProblem);
        }
        if (shadowed && yes) {
          fail(
            'activating the storySort that Storybook currently ignores needs an interactive confirmation, and non-interactive runs keep the current story order. Re-run the migration and confirm the prompt, or move it to storySorts in main manually'
          );
        }
        if (main.get(['storySorts'])) {
          fail('The main config already defines storySorts');
        }
        if (!sorter) {
          fail('storySort must be a statically readable object, array, or comparator function');
        }
        const mainSorters =
          sorter.kind === 'value'
            ? [sorter.value]
            : t.arrayExpression([t.cloneNode(sorter.node, true)]);
        const setting = main.set(['storySorts'], mainSorters);
        if (!setting.ok) {
          fail(setting.diagnostic.message);
        }
      },
    },
    {
      filter: { kind: ['preview'], code: 'storySort' },
      editConfig: (preview) => {
        const named = namedOwner ? preview.namedExport('parameters', 'mutate') : undefined;
        const removal = named ? named.remove(storySortPath) : preview.remove(storySortPath);
        if (!removal.ok) {
          fail(removal.diagnostic.message);
        }
      },
    },
  ],
};
