/**
 * Open the file in the editor
 *
 * Available for builders which support https://github.com/yyx990803/launch-editor
 *
 * Known builders: Webpack5, Vite
 *
 * @param filePath - The path to the file to open in the editor
 * @returns Void
 */
export async function openInEditor(
  filePath: string,
  line?: number,
  column?: number
): Promise<void> {
  let fileLocation = filePath;
  if (typeof line === 'number') {
    fileLocation += `:${line}`;
    if (typeof column === 'number') {
      fileLocation += `:${column}`;
    }
  }

  try {
    await fetch(`/__open-in-editor?file=${encodeURIComponent(fileLocation)}`, {
      method: 'POST',
    });
  } catch {
    // no-op
  }
}
