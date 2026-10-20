import path from 'path';
import fs from 'node:fs/promises';
import { getSnippetFiles, readFileLines, sortCsfSegments } from './utils';
import { esMain } from '../utils/esmain.ts';

/**
 * Moves each CSF Next snippet before its CSF 3 counterpart in all snippet files.
 * Returns the paths of the files it changed.
 */
export async function fixSnippetCsfOrder(docsDir: string): Promise<string[]> {
  const snippetFiles = await getSnippetFiles(docsDir);
  const changed: string[] = [];

  for (const file of snippetFiles) {
    const sorted = sortCsfSegments(await readFileLines(file));
    if (sorted) {
      await fs.writeFile(file, sorted.join('\n'));
      changed.push(file);
    }
  }
  return changed;
}

// CLI entry point
if (esMain(import.meta.url)) {
  fixSnippetCsfOrder(path.resolve(__dirname, '../../docs'))
    .then((changed) => {
      console.log(`✅ Reordered CSF snippets in ${changed.length} file(s).`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
