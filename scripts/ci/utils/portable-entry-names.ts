const cp1252Decoder = new TextDecoder('windows-1252');

// tar.exe converts UTF-8 entry names to the system ANSI code page (Windows-1252
// on the CI images) when extracting an archive; a name it cannot encode makes
// the entry unusable and fails the unpack with a cryptic error.
const cp1252Characters = new Set(
  Array.from({ length: 256 }, (_, byte) => cp1252Decoder.decode(Uint8Array.of(byte)))
);

export function findNonPortableEntryNames(entryNames: string[]): string[] {
  return entryNames.filter((name) =>
    [...name].some((character) => !cp1252Characters.has(character))
  );
}

export function formatNonPortableEntriesError(names: string[]): string {
  return [
    'Non-portable entry names in sandbox archive — Windows tar.exe cannot extract these:',
    ...names.map((name) => `  ${name}`),
    'Fix: make the emitting path derive portable filenames (see open-service static paths).',
  ].join('\n');
}
