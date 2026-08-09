/**
 * Custom oxlint rules for `.agents/guidelines/comments-and-jsdoc.md`.
 *
 * Only the part of that guideline needing no judgement lives here. Whether a comment earns its
 * place is a question for a reviewer, not a linter.
 */
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

/**
 * Docblock pragmas that tooling reads out of the comment itself, so deleting one silently changes
 * how the file is compiled or which environment it runs in.
 */
const PRAGMA =
  /@(vitest|jest)-environment(-options)?\b|@jsx(ImportSource|Runtime|Frag)?\b|@license\b|@preserve\b|@ts-\w/;

export default {
  meta: { name: 'comments' },
  rules: {
    'no-jsdoc-in-tests': {
      meta: {
        type: 'suggestion',
        docs: {
          description:
            'Disallow JSDoc in test files. What a test does belongs in its name, not a docblock.',
        },
        schema: [],
      },
      create(context) {
        if (!TEST_FILE.test(context.filename)) {
          return {};
        }
        return {
          'Program:exit'() {
            for (const comment of context.sourceCode.getAllComments()) {
              if (
                comment.type === 'Block' &&
                comment.value.startsWith('*') &&
                !PRAGMA.test(comment.value)
              ) {
                context.report({
                  loc: comment.loc,
                  message:
                    'No JSDoc in a test file. Put what the test does in its name; use a line comment only for a fixture or environment fact the test cannot state itself.',
                });
              }
            }
          },
        };
      },
    },
  },
};
