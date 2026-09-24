export const matchesWorkspacePattern = (path: string, pattern: string): boolean => {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('**', '\\0');
  const glob = escaped.replaceAll('*', '[^/]*').replaceAll('\\0', '.*');
  return new RegExp(`^${glob}$`).test(path);
};

export const pnpmWorkspacePatterns = (source: string): string[] | undefined => {
  const lines = source.split('\n');
  const packagesIndex = lines.findIndex((line) => /^packages:\s*(?:#.*)?$/.test(line));
  if (packagesIndex === -1) return undefined;

  const patterns: string[] = [];
  for (const line of lines.slice(packagesIndex + 1)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const match = /^\s+-\s+(?:['"]([^'"]+)['"]|([^\s#]+))\s*(?:#.*)?$/.exec(line);
    if (match) {
      patterns.push(match[1] ?? match[2]!);
      continue;
    }
    if (/^\S/.test(line)) break;
    return undefined;
  }
  return patterns.length ? patterns : undefined;
};
