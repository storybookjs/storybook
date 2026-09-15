import { type NodePath, types as t } from 'storybook/internal/babel';
import {
  type CsfFile,
  type ImportRef,
  collectImportBindings,
  freeNames,
} from 'storybook/internal/csf-tools';

/** What a snippet still reaches for in the story file it was extracted from. */
export interface SnippetDependencies {
  /** Module-scope declarations to print above the story, in source order. */
  declarations: t.Statement[];
  /** Imports the snippet needs for the names another module owns. */
  imports: ImportRef[];
  /** Names this pass closed, so a warning does not claim they are still missing. */
  resolved: Set<string>;
}

/**
 * Close the gap between the names a snippet prints and what it declares.
 *
 * Only the story file's own module scope is read: a name it imports becomes an import ref, a name
 * it declares is carried over as the declaration was authored, and anything else - a global, an
 * intrinsic element, a name bound inside the snippet - is left alone.
 */
export function collectSnippetDependencies(
  node: t.Statement,
  csf: CsfFile,
  storyName: string
): SnippetDependencies {
  const program = csf._file.path;
  const bindings = collectImportBindings(program);

  const imports: ImportRef[] = [];
  const resolved = new Set<string>();
  const hoisted = new Map<number, t.Statement>();
  // A name bound to another story resolves to a CSF config object, not to example code, so
  // printing it would put Storybook's own plumbing in the snippet.
  const seen = new Set<string>(
    [
      csf._metaVariableName,
      ...Object.entries(csf._stories).map(([key, story]) => story.localName ?? key),
    ].filter(Boolean) as string[]
  );
  seen.add(storyName);
  const pending = [...freeNames(node)];

  while (pending.length > 0) {
    const name = pending.shift()!;
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);

    const imported = bindings.get(name);
    if (imported) {
      imports.push({
        localImportName: name,
        importId: imported.importId,
        importName: imported.importName,
        ...(imported.importName === '*' ? { namespace: name } : {}),
        // `packageName` rewriting exists for the documented component; these names stay with the
        // module the story file read them from.
        isPackage: true,
      });
      resolved.add(name);
      continue;
    }

    const binding = program.scope.getBinding(name);
    if (!binding) {
      continue;
    }
    const index = moduleStatementIndex(binding.path, program);
    if (index === undefined || hoisted.has(index)) {
      continue;
    }
    const declaration = declarationOf(program.node.body[index], binding.path);
    if (!declaration) {
      continue;
    }
    hoisted.set(index, declaration);
    resolved.add(name);
    pending.push(...freeNames(declaration));
  }

  return {
    declarations: [...hoisted.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, statement]) => statement),
    imports,
    resolved,
  };
}

function moduleStatementIndex(path: NodePath, program: NodePath<t.Program>): number | undefined {
  let current: NodePath | null = path;
  while (current && !current.parentPath?.isProgram()) {
    current = current.parentPath;
  }
  const index = current ? program.node.body.indexOf(current.node as t.Statement) : -1;
  return index === -1 ? undefined : index;
}

// A hoisted declaration is printed on its own, so an `export` keyword that meant something in the
// story file would not compile in the snippet. A statement declaring several names is narrowed to
// the one the snippet asked for, so its siblings - and whatever they in turn name - stay out.
function declarationOf(
  statement: t.Statement | undefined,
  binding: NodePath
): t.Statement | undefined {
  const declaration = t.isExportNamedDeclaration(statement)
    ? (statement.declaration ?? undefined)
    : t.isImportDeclaration(statement) || t.isExportDefaultDeclaration(statement)
      ? undefined
      : statement;

  if (
    t.isVariableDeclaration(declaration) &&
    declaration.declarations.length > 1 &&
    binding.isVariableDeclarator()
  ) {
    return t.variableDeclaration(declaration.kind, [binding.node]);
  }
  return declaration;
}
