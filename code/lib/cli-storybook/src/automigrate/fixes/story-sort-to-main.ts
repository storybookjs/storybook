import { HandledError } from 'storybook/internal/common';
import { traverse, types as t } from 'storybook/internal/babel';
import type { NodePath } from 'storybook/internal/babel';
import { type ConfigFile, type CsfValue, loadConfig } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import type { Fix } from '../types.ts';

// The storySort found in the preview: a statically readable value inlines into main, and a
// self-contained comparator function moves as its AST. Neither — the sorter stays undefined and
// the migration fails with the manual instructions.
type Sorter =
  | { kind: 'value'; value: readonly CsfValue[] | { readonly [key: string]: CsfValue } }
  | { kind: 'comparator'; node: t.Expression };

interface StorySortToMainOptions {
  sorter: Sorter | undefined;
  // Why the preview cannot give up `storySort` safely; the main config then stays untouched too.
  previewProblem?: string;
}

const storySortPath = ['parameters', 'options', 'storySort'];

// A moved comparator may only reach names that read the same from main: those bound inside the
// function, plus the globals undefined, NaN, and Infinity.
const movableGlobals = new Set(['undefined', 'NaN', 'Infinity']);

const movableFunction = (node: t.Expression | undefined): t.Expression | undefined => {
  if (!t.isArrowFunctionExpression(node) && !t.isFunctionExpression(node)) {
    return undefined;
  }
  // Binding facts need real scopes, so traverse a synthetic module around the detached node: a
  // name bound in a nested function no longer satisfies references outside it.
  let movable = true;
  traverse(t.file(t.program([t.expressionStatement(t.cloneNode(node, true))])), {
    Program(program) {
      program.stop();
      program.scope.crawl();
      // get() is typed as a path-or-list union; the exact key always resolves to one path.
      const expressionPath = program.get('body.0.expression') as NodePath;
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

const fail = (reason: string): never => {
  throw new HandledError(
    `Cannot automigrate storySort: ${reason}. Storybook no longer reads parameters.options.storySort from the preview. Move it to storySorts in the main config manually and remove the preview property. Note that a comparator moved to the main config runs in Node during story indexing.`
  );
};

const firstProblem = (config: ConfigFile) => config.mutationDiagnostics[0]?.message;

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
    const value = preview.getValue(storySortPath);
    let sorter: Sorter | undefined;
    if (value !== undefined && value !== null && typeof value === 'object') {
      sorter = { kind: 'value', value };
    } else {
      const comparator = movableFunction(preview.get(storySortPath));
      sorter = comparator ? { kind: 'comparator', node: comparator } : undefined;
    }
    // The main config is visited first, so its hook learns here whether the preview edit will
    // fail; the probe mutates only this throwaway check parse, and diagnostics from the reads
    // themselves (an unreadable comparator) must not block the migration.
    const beforeProbe = preview.mutationDiagnostics.length;
    preview.remove(storySortPath);
    return { sorter, previewProblem: preview.mutationDiagnostics[beforeProbe]?.message };
  },

  prompt: () =>
    `Move ${picocolors.cyan('parameters.options.storySort')} from preview to ${picocolors.cyan('storySorts')} in main?`,

  transform: ({ result: { sorter, previewProblem } }) => [
    {
      filter: { kind: ['main'] },
      editConfig: (main) => {
        if (previewProblem) {
          fail(previewProblem);
        }
        if (main.get(['storySorts'])) {
          fail('The main config already defines storySorts');
        }
        if (!sorter) {
          fail('storySort must be a statically readable object, array, or comparator function');
          return;
        }
        const mainSorters =
          sorter.kind === 'value'
            ? [sorter.value]
            : t.arrayExpression([t.cloneNode(sorter.node, true)]);
        main.set(['storySorts'], mainSorters);
        const mainProblem = firstProblem(main);
        if (mainProblem) {
          fail(mainProblem);
        }
      },
    },
    {
      filter: { kind: ['preview'], code: 'storySort' },
      editConfig: (preview) => preview.remove(storySortPath),
    },
  ],
};
