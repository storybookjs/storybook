import { readFile, writeFile } from 'node:fs/promises';

function transformImports(source: string, renamedImports: Record<string, string>) {
  let hasChanges = false;
  let transformed = source;

  for (const [from, to] of Object.entries(renamedImports)) {
    // Match the package name when it's inside either single or double quotes
    const regex = new RegExp(`(['"])${from}(\/.*)?\\1`, 'g');
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
