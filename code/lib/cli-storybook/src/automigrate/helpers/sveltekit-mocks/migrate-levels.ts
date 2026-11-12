import { HandledError } from 'storybook/internal/common';
import { type ESTree as E, type SourceEditor, locationOf } from 'storybook/internal/csf-tools';

import {
  INLINE_PROBLEM,
  SPREAD_DOCS_PROBLEM,
  SPREAD_PROBLEM,
  addInlineFalseToMeta,
  inlineOf,
  isFalse,
  spreadsBeforeEach,
  uncopiedSpread,
} from './edit-levels.ts';
import { MockImports, aliasedImports, readsName } from './mock-imports.ts';
import { type LevelMocks, type Problem, KEY, keepSpies, writesMocks } from './mock-statements.ts';
import { printMocks } from './print-mocks.ts';

export const MIGRATION_LINK =
  'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#sveltekit-sveltekit_experimental-parameters-removed';

// Throw one error that lists every problem with its line, so the runner reports the file.
export const failWith = (code: string, problems: Problem[]): never => {
  const reasons = [...problems]
    .sort((a, b) => a.index - b.index)
    .map(({ index, message }) => `line ${locationOf(code, index, index).start.line}: ${message}`);
  throw new HandledError(
    `Could not migrate \`${KEY}\`, so this file is unchanged. ${[...new Set(reasons)].join(' ')} Migrate it by hand: ${MIGRATION_LINK}`
  );
};

export const takenNames = (editor: SourceEditor, spies: E.VariableDeclarator[]) => {
  const freed = new Set(spies.map((spy) => (spy.id as E.BindingIdentifier).name));
  return [...editor.scopes.program.bindings.keys(), ...editor.scopes.tsDeclarationNames].filter(
    (name) => !freed.has(name)
  );
};

export const styleOf = (editor: SourceEditor) => ({
  quote: editor.quote,
  semicolons: editor.semicolons,
  indent: editor.indent,
});

export interface EditOptions {
  // Add `parameters.docs.story.inline: false`, which only the meta gets
  inlineFalse: boolean;
  semicolon: string;
  step: string;
}

// A preview, meta or story whose `sveltekit_experimental` the fix replaces
export interface Level {
  kind: 'preview' | 'meta' | 'story';
  // The code that holds `sveltekit_experimental`, and the generated code
  editor: SourceEditor;
  toFile: (index: number) => number;
  sveltekit: E.ObjectProperty;
  // The object literal that gets `beforeEach`, when the level has one
  object?: E.ObjectExpression;
  mocks: LevelMocks;
  edit: (statements: string[], options: EditOptions) => void;
}

// A file as an adapter reads it, for `migrateLevels`
export interface MigrationFile {
  code: string;
  // The code that gets the imports, and that holds the meta
  module: SourceEditor;
  levels: Level[];
  // The problems that only the adapter can find, at file indexes
  problems: Problem[];
  // The functions that the preview gives an implementation
  implemented: Iterable<string>;
  // The meta and whether a docs page renders its stories inline, for a stories file
  docs?: { meta: E.ObjectExpression; toFile: (index: number) => number; hasDocsPage: boolean };
  // Names that something else takes where the generated code runs, such as a Svelte instance script
  shadowed?: string[];
  // The code outside `module` after the edits, such as the markup of a Svelte file
  outside?: () => string;
  toString: () => string;
}

// Migrate the levels of a file, or `null` when it has none. A problem leaves the file unchanged.
export const migrateLevels = (file: MigrationFile) => {
  const { code, module, levels, docs, shadowed = [] } = file;
  const problems = [
    ...file.problems,
    ...levels.flatMap(({ mocks, toFile }) =>
      mocks.problems.map((problem) => ({ ...problem, index: toFile(problem.index) }))
    ),
    ...levels
      .filter(({ object, mocks }) => object && spreadsBeforeEach(object) && mocks.ops.length > 0)
      .map(({ object, toFile }) => ({ index: toFile(object!.start), message: SPREAD_PROBLEM })),
  ];

  // A spy stays when a level or the preview gives its function an implementation: other code can
  // call the spy, which the imported mock would run that implementation for
  const kept = new Set([
    ...file.implemented,
    ...levels.flatMap(({ mocks }) => mocks.merged.functions),
    ...aliasedImports(module),
  ]);
  // A docs page renders the stories inline, where they share the mocks
  const docsPage = !!docs?.hasDocsPage && levels.some(({ mocks }) => writesMocks(mocks, kept));
  const inline = docsPage ? inlineOf(docs!.meta) : undefined;
  if (inline && !isFalse(inline.value)) {
    problems.push({ index: docs!.toFile(inline.start), message: INLINE_PROBLEM });
  }
  const spread = docsPage && !inline ? uncopiedSpread(docs!.meta) : undefined;
  if (spread) {
    problems.push({ index: docs!.toFile(spread.start), message: SPREAD_DOCS_PROBLEM });
  }
  if (problems.length > 0) {
    failWith(code, problems);
  }
  if (levels.length === 0) {
    return null;
  }

  levels.forEach(({ mocks }) => keepSpies(mocks, kept));
  const spies = levels.flatMap(({ mocks }) => mocks.spies);
  const imports = new MockImports(module, [...takenNames(module, spies), ...shadowed], shadowed);
  const style = styleOf(module);
  const printed = levels.map((level) =>
    printMocks(level.editor, level.mocks, imports.local, style)
  );
  const inlineFalse = docsPage && !inline;
  const options = { semicolon: style.semicolons ? ';' : '', step: style.indent };
  levels.forEach((level, index) =>
    level.edit(printed[index], { ...options, inlineFalse: inlineFalse && level.kind === 'meta' })
  );
  if (inlineFalse && !levels.some(({ kind }) => kind === 'meta')) {
    addInlineFalseToMeta(module, docs!.meta);
  }
  imports.apply(
    spies,
    levels.filter((level) => level.editor === module).map(({ sveltekit }) => sveltekit),
    (name) => readsName([...printed.flat(), ...(file.outside ? [file.outside()] : [])], name)
  );
  return file.toString();
};
