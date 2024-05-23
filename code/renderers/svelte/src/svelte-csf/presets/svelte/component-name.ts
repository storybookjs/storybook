// From https://github.com/sveltejs/svelte/blob/8db3e8d0297e052556f0b6dde310ef6e197b8d18/src/compiler/compile/utils/get_name_from_filename.ts
// Copied because it is not exported from the compiler
export function getNameFromFilename(filename: string) {
  if (!filename) return null;

  const parts = filename.split(/[/\\]/).map(encodeURI);

  if (parts.length > 1) {
    const indexMatch = parts[parts.length - 1].match(/^index(\.\w+)/);
    if (indexMatch) {
      parts.pop();
      parts[parts.length - 1] += indexMatch[1];
    }
  }

  if (!parts) return null;

  const base = parts
    .pop()
    ?.replace(/%/g, 'u')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z_$0-9]+/g, '_')
    .replace(/^_/, '')
    .replace(/_$/, '')
    .replace(/^(\d)/, '_$1');

  if (!base) {
    throw new Error(`Could not derive component name from file ${filename}`);
  }

  return base[0].toUpperCase() + base.slice(1);
}
