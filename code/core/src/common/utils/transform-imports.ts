/**
 * Rename imported and required packages, including their sub-paths. Returns `null` when no package
 * matched.
 */
export function transformImports(source: string, renamedImports: Record<string, string>) {
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
