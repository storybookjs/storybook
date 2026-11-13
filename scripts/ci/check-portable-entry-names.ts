// Fails when a name under the sandbox directory cannot be encoded in the
// Windows ANSI code page, because the Windows unpack step could not extract
// such an archive. Usage: node scripts/ci/check-portable-entry-names.ts <dir>
//
// Runs under plain `node`: Node strips types by default since 22.18 (the
// create image ships 22.22.3), which accepts only erasable TypeScript — no
// enums, namespaces, or parameter properties. The scripts typecheck does not
// enforce `erasableSyntaxOnly`, so this comment is the guard.
import {
  findNonPortableEntryNames,
  formatNonPortableEntriesError,
  listEntryNamesUnder,
} from './utils/portable-entry-names.ts';

const root = process.argv[2];

if (!root) {
  console.error('Usage: node scripts/ci/check-portable-entry-names.ts <sandbox-dir>');
  process.exit(2);
}

const entries = await listEntryNamesUnder(root);
const nonPortable = findNonPortableEntryNames(entries);

if (nonPortable.length > 0) {
  console.error(formatNonPortableEntriesError(nonPortable));
  process.exit(1);
}

console.log(`All ${entries.length} entries in ${root} are Windows-portable.`);
