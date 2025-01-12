import type { SourceBlock } from './types';

export * from './types';

/** Given a location, extract the text from the full source */
export function extractSource(location: SourceBlock, lines: string[]): string | null {
  const { startBody: start, endBody: end } = location;
  if (start.line === end.line && lines[start.line - 1] !== undefined) {
    return lines[start.line - 1].substring(start.col, end.col);
  }
  // NOTE: storysource locations are 1-based not 0-based!
  const startLine = lines[start.line - 1];
  const endLine = lines[end.line - 1];
  if (startLine === undefined || endLine === undefined) {
    return null;
  }
  return [
    startLine.substring(start.col),
    ...lines.slice(start.line, end.line - 1),
    endLine.substring(0, end.col),
  ].join('\n');
}
