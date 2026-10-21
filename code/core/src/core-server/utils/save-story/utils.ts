import type {
  CsfFile,
  CsfMutationDiagnostic,
  CsfMutationResult,
  CsfObject,
} from 'storybook/internal/csf-tools';
import { printCsfPath } from 'storybook/internal/csf-tools';

import { type Node, unwrapExpression } from '../../../csf-tools/estree/ast.ts';

export class SaveStoryError extends Error {}

/**
 * The story `exportName` is another name for, as in `export { Primary as Secondary }` or `export
 * const Secondary = Primary`, when that is a story of the file too.
 */
export const originalStoryOf = (csf: CsfFile, exportName: string) => {
  const node = csf._storyExports[exportName] as Node | undefined;
  let original: string | undefined;
  if (node?.type === 'VariableDeclarator' && node.init) {
    const init = unwrapExpression(node.init as Node);
    original = init.type === 'Identifier' ? init.name : undefined;
  } else {
    for (const statement of csf.program.body) {
      if (statement.type !== 'ExportNamedDeclaration' || statement.source) {
        continue;
      }
      const specifier = statement.specifiers.find(
        ({ exported }) =>
          (exported.type === 'Identifier' ? exported.name : exported.value) === exportName
      );
      if (specifier?.local.type === 'Identifier') {
        original = specifier.local.name;
      }
    }
  }
  return original !== undefined && original !== exportName && Object.hasOwn(csf._stories, original)
    ? original
    : undefined;
};

// What the controls panel shows when csf-tools refuses an edit of story `exportName`. The
// diagnostic is written for API callers, so it only goes to the server log, as the cause.
const describeRefusal = (csf: CsfFile, exportName: string, diagnostic: CsfMutationDiagnostic) => {
  const { code, path } = diagnostic;
  const [field, key] = path;
  const subject =
    path.length === 0
      ? `story ${exportName}`
      : field === 'args' && key !== undefined
        ? `arg "${key}" of story ${exportName}`
        : `${printCsfPath(path)} of story ${exportName}`;
  switch (code) {
    case 'spread-field':
      return `Cannot save ${subject} because a spread in the story could override it.`;
    case 'unsupported-member':
      return field === 'args'
        ? `Cannot save ${subject} because the args of the story are not an object written in the story itself, for example a constant that other stories share.`
        : `Cannot save ${subject} because it is not written as an object in the story itself.`;
    case 'duplicate-field':
      return `Cannot save ${subject} because the story sets it more than once.`;
    case 'aliased-story': {
      const original = originalStoryOf(csf, exportName);
      return original
        ? `Cannot save story ${exportName} because it is the same story as ${original}. Save ${original} instead.`
        : `Cannot save story ${exportName} because it is another name for a story in this file. Save that story instead.`;
    }
    case 'ambiguous-binding':
      return `Cannot save ${subject} because other code in the file changes or shares the story.`;
    case 'unsupported-initializer':
      return `Cannot save ${subject} because its configuration is not written inline in this file.`;
    case 'invalid-csf':
      return `Cannot save ${subject} because the result would not be a valid story file.`;
    default:
      return diagnostic.message;
  }
};

const refused = (csf: CsfFile, exportName: string, diagnostic: CsfMutationDiagnostic) =>
  new SaveStoryError(describeRefusal(csf, exportName, diagnostic), { cause: diagnostic });

export const findStory = (csf: CsfFile, exportName: string): CsfObject => {
  const found = csf.storyObject(exportName);
  if (!found) {
    throw new SaveStoryError(`Cannot edit story ${exportName} automatically`);
  }
  if (!found.ok) {
    throw refused(csf, exportName, found.diagnostic);
  }
  return found.object;
};

export const assertApplied = (csf: CsfFile, exportName: string, result: CsfMutationResult) => {
  if (!result.ok) {
    throw refused(csf, exportName, result.diagnostic);
  }
};
