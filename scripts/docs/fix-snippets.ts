import path from 'path';
import fs from 'node:fs/promises';
import { addCsf3Deprecation, getSnippetFiles, readFileLines, sortCsfSegments } from './utils';
import { esMain } from '../utils/esmain.ts';

/**
 * Fixes snippet files: moves each CSF 4 snippet before its CSF 3 counterpart, then adds the
 * deprecation comment to each CSF 3 snippet that lacks it.
 * Returns the paths of the files it changed.
 */
export async function fixSnippets(docsDir: string): Promise<string[]> {
  const snippetFiles = await getSnippetFiles(docsDir);
  const changed: string[] = [];

  for (const file of snippetFiles) {
    const lines = await readFileLines(file);
    const sorted = sortCsfSegments(lines) ?? lines;
    const fixed = addCsf3Deprecation(sorted) ?? sorted;
    if (fixed !== lines) {
      await fs.writeFile(file, fixed.join('\n'));
      changed.push(file);
    }
  }
  return changed;
}

// CLI entry point
if (esMain(import.meta.url)) {
  fixSnippets(path.resolve(__dirname, '../../docs'))
    .then((changed) => {
      console.log(`✅ Fixed snippets in ${changed.length} file(s).`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
