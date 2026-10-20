import { HandledError } from 'storybook/internal/common';
import {
  type ConfigFile,
  type CsfFile,
  type CsfMutationDiagnostic,
  type CsfObject,
  type ESTree as E,
  unwrapExpression,
} from 'storybook/internal/csf-tools';

type ParsedFile = { mutationDiagnostics: ConfigFile['mutationDiagnostics'] };

// Diagnostics an edit has shown it does not need to act on, so they do not fail the file.
const covered = new WeakSet<CsfMutationDiagnostic>();

const describeDiagnostic = ({ message, loc }: CsfMutationDiagnostic) =>
  loc ? `line ${loc.start.line}: ${message}` : message;

/** Run `edit` on a parsed file, and throw the mutation diagnostics it left, with their lines. */
export const editParsedFile = async <File extends ParsedFile>(
  file: File,
  edit: (file: File) => unknown
) => {
  const diagnosticsBefore = file.mutationDiagnostics.length;
  await edit(file);
  const diagnostics = file.mutationDiagnostics
    .slice(diagnosticsBefore)
    .filter((diagnostic) => !covered.has(diagnostic));
  if (diagnostics.length > 0) {
    throw new HandledError([...new Set(diagnostics.map(describeDiagnostic))].join('; '));
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

// The initializer of a top-level `const`, whose binding nothing can reassign.
const constInitializer = (csf: CsfFile, name: string) => {
  for (const statement of csf.program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type !== 'VariableDeclaration' || declaration.kind !== 'const') {
      continue;
    }
    for (const declarator of declaration.declarations) {
      if (declarator.id.type === 'Identifier' && declarator.id.name === name) {
        return declarator.init ? unwrapExpression(declarator.init) : undefined;
      }
    }
  }
  return undefined;
};

/**
 * Discover the meta and stories, as `csf.objects()` does, for an edit that applies alike to every
 * object it returns. A story declared as another story, such as `export const Secondary = Primary`,
 * shares that story's object, so editing that story covers it: discovery reports it as an
 * `unsupported-initializer`, which does not fail the file.
 */
export const everyCsfObject = (csf: CsfFile): readonly CsfObject[] => {
  const diagnosticsBefore = csf.mutationDiagnostics.length;
  const objects = csf.objects();
  const edited = new Set(
    objects.flatMap(({ target }) => (target.kind === 'story' ? [target.localName] : []))
  );
  const aliases = csf.mutationDiagnostics.slice(diagnosticsBefore).flatMap((diagnostic) => {
    const { code, path, target } = diagnostic;
    if (code !== 'aliased-story' || path.length > 0 || target.kind !== 'story') {
      return [];
    }
    const init = constInitializer(csf, target.localName);
    return init?.type === 'Identifier'
      ? [{ diagnostic, name: target.localName, of: init.name }]
      : [];
  });
  // An alias of an alias is covered once the story it names is.
  for (let found = true; found;) {
    found = false;
    for (const { diagnostic, name, of } of aliases) {
      if (!covered.has(diagnostic) && edited.has(of)) {
        covered.add(diagnostic);
        edited.add(name);
        found = true;
      }
    }
  }
  return objects;
};
