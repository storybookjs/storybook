import { HandledError } from 'storybook/internal/common';
import type {
  ConfigFile,
  CsfMutationDiagnostic,
  CsfObject,
  ESTree as E,
} from 'storybook/internal/csf-tools';

type ParsedFile = { mutationDiagnostics: ConfigFile['mutationDiagnostics'] };

const describeDiagnostic = ({ message, loc }: CsfMutationDiagnostic) =>
  loc ? `line ${loc.start.line}: ${message}` : message;

export const editParsedFile = async <File extends ParsedFile>(
  file: File,
  edit: (file: File) => unknown,
  errorContext?: string
) => {
  try {
    const diagnosticsBefore = file.mutationDiagnostics.length;
    await edit(file);
    const diagnostics = file.mutationDiagnostics
      .slice(diagnosticsBefore)
      // An alias holds its story's object: the edit sees it, or that story reports why not.
      .filter(({ code }) => code !== 'aliased-story');
    if (diagnostics.length > 0) {
      throw new HandledError([...new Set(diagnostics.map(describeDiagnostic))].join('; '));
    }
  } catch (error) {
    if (errorContext && error instanceof HandledError) {
      const separator = /[.!?]$/.test(error.message) ? ' ' : '. ';
      throw new HandledError(`${error.message}${separator}${errorContext}`);
    }
    throw error;
  }
};

/**
 * Read the expression at a path that decides an edit, or `undefined` when it is missing. A field
 * that cannot be read statically throws like a refused edit, so the file is reported, not skipped.
 */
export const readForEdit = (
  object: CsfObject,
  path: readonly string[]
): E.Expression | undefined => {
  const found = object.inspect(path);
  if (found.kind === 'unreadable') {
    throw new HandledError(describeDiagnostic(found.diagnostic));
  }
  return found.kind === 'value' ? found.node : undefined;
};
