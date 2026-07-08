import { readFile, writeFile } from 'node:fs/promises';

export function buildImportRenameRegex(from: string): RegExp {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(['"])${escaped}(\\/.*)?\\1`, 'g');
}

function transformImports(source: string, renamedImports: Record<string, string>) {
  let hasChanges = false;
  let transformed = source;

  for (const [from, to] of Object.entries(renamedImports)) {
    const regex = buildImportRenameRegex(from);
    if (regex.test(transformed)) {
      transformed = transformed.replace(regex, `$1${to}$2$1`);
      hasChanges = true;
    }
  }

  return hasChanges ? transformed : null;
}

export const transformImportFiles = async (
  files: string[],
  renamedImports: Record<string, string>,
  dryRun?: boolean
) => {
  const errors: Array<{ file: string; error: Error }> = [];
  const { default: pLimit } = await import('p-limit');
  const limit = pLimit(10);

  await Promise.all(
    files.map((file) =>
      limit(async () => {
        try {
          const contents = await readFile(file, 'utf-8');
          const transformed = transformImports(contents, renamedImports);
          if (!dryRun && transformed) {
            await writeFile(file, transformed);
          }
        } catch (error) {
          errors.push({ file, error: error as Error });
        }
      })
    )
  );

  return errors;
};
