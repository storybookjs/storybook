// Fails when a name under the sandbox directory cannot be encoded in the
// Windows ANSI code page, because the Windows unpack step could not extract
// such an archive. Usage: node scripts/ci/check-portable-entry-names.ts <dir>
import { readdir } from 'node:fs/promises';

import {
  findNonPortableEntryNames,
  formatNonPortableEntriesError,
} from './utils/portable-entry-names.ts';

const root = (process.argv[2] ?? '').replace(/[/\\]+$/, '');

if (!root) {
  console.error('Usage: node scripts/ci/check-portable-entry-names.ts <sandbox-dir>');
  process.exit(2);
}

const entries = await readdir(root, { recursive: true });

// The recursive listing is already relative to the scanned directory — the form
// tar stores entry names in.
const nonPortable = findNonPortableEntryNames(entries.sort());

if (nonPortable.length > 0) {
  console.error(formatNonPortableEntriesError(nonPortable));
  process.exit(1);
}

console.log(`All ${entries.length} entries in ${root} are Windows-portable.`);
