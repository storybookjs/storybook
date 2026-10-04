import { HandledError } from 'storybook/internal/common';
import type { ConfigFile } from 'storybook/internal/csf-tools';

type ParsedFile = { mutationDiagnostics: ConfigFile['mutationDiagnostics'] };

/** Run `edit` on a parsed file, and throw the mutation diagnostics it left, with their lines. */
export const editParsedFile = async <File extends ParsedFile>(
  file: File,
  edit: (file: File) => unknown
) => {
  const diagnosticsBefore = file.mutationDiagnostics.length;
  await edit(file);
  const diagnostics = file.mutationDiagnostics.slice(diagnosticsBefore);
  if (diagnostics.length > 0) {
    const messages = diagnostics.map(({ message, loc }) =>
      loc ? `line ${loc.start.line}: ${message}` : message
    );
    throw new HandledError([...new Set(messages)].join('; '));
  }
};
