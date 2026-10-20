import { glob } from 'tinyglobby';
import fs from 'node:fs/promises';

/**
 * Recursively collects all .mdx files in the given docs directory.
 */
export async function getMdxFiles(docsDir: string): Promise<string[]> {
  return glob(['**/*.mdx'], { cwd: docsDir, absolute: true });
}

/**
 * Reads a file and returns an array of its lines.
 */
export async function readFileLines(filePath: string): Promise<string[]> {
  const content = await fs.readFile(filePath, 'utf8');
  return content.split(/\r?\n/);
}

/**
 * Converts a heading text to a URL-friendly slug.
 * Matches the behavior of typical MDX/rehype-slug processors.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // Strip markdown links, keep text
    .replace(/[`*_~\\]/g, '') // Strip inline formatting and MDX escape chars
    .replace(/[<>]/g, '') // Remove angle brackets but keep their content
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (except spaces and hyphens)
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Trim leading/trailing hyphens
}

export type LineContext = 'frontmatter' | 'codeblock' | 'content';

/**
 * Returns a per-line context array indicating whether each line is inside
 * frontmatter, a fenced code block, or normal content.
 */
export function getLineContexts(lines: string[]): LineContext[] {
  const contexts: LineContext[] = [];
  let inFrontmatter = false;
  let frontmatterSeen = false;
  let inCodeBlock = false;
  let openFenceLen = 0;
  let openFenceChar = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!frontmatterSeen && !inFrontmatter && i === 0 && line.trim() === '---') {
      inFrontmatter = true;
      contexts.push('frontmatter');
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === '---') {
        inFrontmatter = false;
        frontmatterSeen = true;
      }
      contexts.push('frontmatter');
      continue;
    }

    const fenceMatch = line.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        openFenceLen = fenceMatch[1].length;
        openFenceChar = fenceMatch[1][0];
        contexts.push('codeblock');
        continue;
      } else if (
        fenceMatch[1][0] === openFenceChar &&
        fenceMatch[1].length >= openFenceLen &&
        line.trim() === fenceMatch[1]
      ) {
        inCodeBlock = false;
        contexts.push('codeblock');
        continue;
      }
    }
    if (inCodeBlock) {
      contexts.push('codeblock');
      continue;
    }

    contexts.push('content');
  }

  return contexts;
}

/**
 * Extracts all heading slugs from an MDX file.
 * Returns a Set of slug strings (without the leading #).
 */
export async function getHeadingSlugs(filePath: string): Promise<Set<string>> {
  const lines = await readFileLines(filePath);
  const slugs = new Set<string>();
  const headingRegex = /^(#{1,6})\s+(.+)$/;

  for (const line of lines) {
    const match = headingRegex.exec(line);
    if (match) {
      slugs.add(slugify(match[2]));
    }
  }

  return slugs;
}

/**
 * Collects all .md snippet files in the docs `_snippets` directory.
 */
export async function getSnippetFiles(docsDir: string): Promise<string[]> {
  return glob(['_snippets/**/*.md'], { cwd: docsDir, absolute: true });
}

export interface SnippetSegment {
  /** First line of the segment, including any HTML comments attached above the fence */
  start: number;
  /** Line of the opening fence */
  fenceLine: number;
  /** Line of the closing fence */
  end: number;
  attributes: Record<string, string>;
}

/**
 * Splits a snippet file into segments: one per fenced code block, plus the HTML comments
 * directly above it (blank lines between them are allowed). Comments such as
 * `<!-- prettier-ignore -->` belong to the block that follows, so they move with it.
 */
export function getSnippetSegments(lines: string[]): SnippetSegment[] {
  const segments: SnippetSegment[] = [];

  for (let i = 0; i < lines.length; i++) {
    const openMatch = lines[i].match(/^(`{3,}|~{3,})/);
    if (!openMatch) continue;

    const fence = openMatch[1];
    const fenceLine = i;
    const isClosingFence = (line: string) => {
      const closeMatch = line.trim().match(/^(`{3,}|~{3,})$/);
      return closeMatch?.[1][0] === fence[0] && closeMatch[1].length >= fence.length;
    };
    let end = i + 1;
    while (end < lines.length - 1 && !isClosingFence(lines[end])) {
      end++;
    }

    const lowerBound = segments.length ? segments[segments.length - 1].end + 1 : 0;
    let start = fenceLine;
    let cursor = fenceLine - 1;
    while (cursor >= lowerBound) {
      if (lines[cursor].trim() === '') {
        cursor--;
        continue;
      }
      if (!lines[cursor].trim().endsWith('-->')) break;
      let commentStart = cursor;
      while (commentStart >= lowerBound && !lines[commentStart].trim().startsWith('<!--')) {
        commentStart--;
      }
      if (commentStart < lowerBound) break;
      start = commentStart;
      cursor = commentStart - 1;
    }

    const attributes: Record<string, string> = {};
    for (const [, key, value] of lines[fenceLine].matchAll(/([\w.-]+)="([^"]*)"/g)) {
      attributes[key] = value;
    }

    segments.push({ start, fenceLine, end, attributes });
    i = end;
  }

  return segments;
}

type CsfVersion = 'next' | 'csf3';

const CSF_TAB_TITLE_REGEX = /\(?CSF (Next 🧪|3)\)?/;

/**
 * Returns which CSF version a snippet's `tabTitle` names, and the rest of the title. Titles like
 * `Head (CSF 3)` and `Head (CSF Next 🧪)` share the base `Head`, so they pair up.
 */
function parseCsfTabTitle(tabTitle = ''): { version?: CsfVersion; base: string } {
  const match = tabTitle.match(CSF_TAB_TITLE_REGEX);
  if (!match) return { base: tabTitle };
  return {
    version: match[1] === '3' ? 'csf3' : 'next',
    base: tabTitle.replace(CSF_TAB_TITLE_REGEX, '').trim(),
  };
}

/**
 * Groups the CSF 3 and CSF Next segments of a snippet file. Segments in a group are alternatives
 * of the same example for one renderer, language, and package manager.
 */
export function getCsfSegmentGroups(segments: SnippetSegment[]) {
  const groups = new Map<string, { segment: SnippetSegment; version: CsfVersion }[]>();
  for (const segment of segments) {
    const { renderer, language, packageManager, tabTitle } = segment.attributes;
    const { version, base } = parseCsfTabTitle(tabTitle);
    if (!version) continue;
    const key = [renderer, language, packageManager, base].join('|');
    groups.set(key, [...(groups.get(key) ?? []), { segment, version }]);
  }
  return [...groups.values()];
}

/**
 * Returns the CSF 3 segments that come before their CSF Next counterpart.
 */
export function getMisorderedCsfSegments(lines: string[]): SnippetSegment[] {
  return getCsfSegmentGroups(getSnippetSegments(lines)).flatMap((group) => {
    const firstNext = group.findIndex(({ version }) => version === 'next');
    const firstCsf3 = group.findIndex(({ version }) => version === 'csf3');
    return firstNext > -1 && firstCsf3 > -1 && firstCsf3 < firstNext
      ? [group[firstCsf3].segment]
      : [];
  });
}

/**
 * Moves each CSF Next segment before its CSF 3 counterpart. Segments trade places within the slots
 * their group already occupies, so all other content stays where it is.
 * Returns the reordered lines, or `undefined` if nothing changed.
 */
export function sortCsfSegments(lines: string[]): string[] | undefined {
  const replacements = new Map<SnippetSegment, SnippetSegment>();
  for (const group of getCsfSegmentGroups(getSnippetSegments(lines))) {
    const sorted = [
      ...group.filter(({ version }) => version === 'next'),
      ...group.filter(({ version }) => version === 'csf3'),
    ];
    group.forEach(({ segment }, idx) => {
      if (sorted[idx].segment !== segment) replacements.set(segment, sorted[idx].segment);
    });
  }
  if (replacements.size === 0) return undefined;

  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const slot = [...replacements.keys()].find((segment) => segment.start === i);
    if (slot) {
      const replacement = replacements.get(slot)!;
      result.push(...lines.slice(replacement.start, replacement.end + 1));
      i = slot.end;
    } else {
      result.push(lines[i]);
    }
  }
  return result;
}
