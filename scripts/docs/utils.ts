import fs from 'node:fs/promises';
import { glob } from 'tinyglobby';

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
  /** Language name after the opening fence, such as `ts` or `svelte` */
  syntax: string;
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

    segments.push({
      start,
      fenceLine,
      end,
      syntax: lines[fenceLine].slice(fence.length).split(' ')[0],
      attributes,
    });
    i = end;
  }

  return segments;
}

type CsfVersion = 'csf4' | 'csf3';

const CSF_TAB_TITLE_REGEX = /\(?CSF (4|3)\)?/;

/**
 * Returns which CSF version a snippet's `tabTitle` names, and the rest of the title. Titles like
 * `Head (CSF 3)` and `Head (CSF 4)` share the base `Head`, so they pair up.
 */
function parseCsfTabTitle(tabTitle = ''): { version?: CsfVersion; base: string } {
  const match = tabTitle.match(CSF_TAB_TITLE_REGEX);
  if (!match) return { base: tabTitle };
  return {
    version: match[1] === '3' ? 'csf3' : 'csf4',
    base: tabTitle.replace(CSF_TAB_TITLE_REGEX, '').trim(),
  };
}

interface CsfSegment {
  segment: SnippetSegment;
  version: CsfVersion;
  /** Everything except the renderer that decides whether two segments are versions of one tab */
  key: string;
}

function getCsfSegments(segments: SnippetSegment[]): CsfSegment[] {
  return segments.flatMap((segment) => {
    const { language, packageManager, tabTitle } = segment.attributes;
    const { version, base } = parseCsfTabTitle(tabTitle);
    return version ? [{ segment, version, key: [language, packageManager, base].join('|') }] : [];
  });
}

/**
 * The docs site shows a reader the blocks for their renderer plus all `common` blocks, so two
 * segments can appear together if either one is `common`.
 */
function canShareView(a: SnippetSegment, b: SnippetSegment) {
  const rendererA = a.attributes.renderer;
  const rendererB = b.attributes.renderer;
  return rendererA === rendererB || rendererA === 'common' || rendererB === 'common';
}

/**
 * Groups the CSF 3 and CSF 4 segments of a snippet file. A group holds every segment that can
 * appear as the same tab in one reader's view, including through a shared `common` segment.
 */
export function getCsfSegmentGroups(segments: SnippetSegment[]): CsfSegment[][] {
  const csfSegments = getCsfSegments(segments);
  const groupOf = csfSegments.map((_, idx) => idx);
  const findGroup = (idx: number): number =>
    groupOf[idx] === idx ? idx : (groupOf[idx] = findGroup(groupOf[idx]));

  csfSegments.forEach((a, i) => {
    csfSegments.forEach((b, j) => {
      if (j > i && a.key === b.key && canShareView(a.segment, b.segment)) {
        groupOf[findGroup(j)] = findGroup(i);
      }
    });
  });

  const groups = new Map<number, CsfSegment[]>();
  csfSegments.forEach((csfSegment, idx) => {
    const group = findGroup(idx);
    groups.set(group, [...(groups.get(group) ?? []), csfSegment]);
  });
  return [...groups.values()];
}

/**
 * Returns the CSF 3 segments that come before their CSF 4 counterpart in any reader's view.
 * A view is one renderer's blocks plus the `common` blocks, as the docs site shows them.
 */
export function getMisorderedCsfSegments(lines: string[]): SnippetSegment[] {
  const misordered = findMisorderedCsfSegments(getCsfSegments(getSnippetSegments(lines)));
  return [...misordered].sort((a, b) => a.start - b.start);
}

function findMisorderedCsfSegments(csfSegments: CsfSegment[]): Set<SnippetSegment> {
  const renderers = new Set(csfSegments.map(({ segment }) => segment.attributes.renderer));
  const misordered = new Set<SnippetSegment>();

  for (const renderer of renderers) {
    const view = csfSegments.filter(({ segment }) =>
      [renderer, 'common'].includes(segment.attributes.renderer)
    );
    for (const key of new Set(view.map((csfSegment) => csfSegment.key))) {
      const tab = view.filter((csfSegment) => csfSegment.key === key);
      const firstCsf4 = tab.findIndex(({ version }) => version === 'csf4');
      const firstCsf3 = tab.findIndex(({ version }) => version === 'csf3');
      if (firstCsf4 > -1 && firstCsf3 > -1 && firstCsf3 < firstCsf4) {
        misordered.add(tab[firstCsf3].segment);
      }
    }
  }
  return misordered;
}

/**
 * Moves each CSF 4 segment before its CSF 3 counterpart. Segments trade places within the slots
 * their group already occupies, so all other content stays where it is. Groups that are already
 * in order in every reader's view stay as they are.
 * Returns the reordered lines, or `undefined` if nothing changed.
 */
export function sortCsfSegments(lines: string[]): string[] | undefined {
  const segments = getSnippetSegments(lines);
  const misordered = findMisorderedCsfSegments(getCsfSegments(segments));
  const replacements = new Map<SnippetSegment, SnippetSegment>();
  for (const group of getCsfSegmentGroups(segments)) {
    if (!group.some(({ segment }) => misordered.has(segment))) continue;
    const sorted = [
      ...group.filter(({ version }) => version === 'csf4'),
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

/**
 * Returns the current name for a `tabTitle` that uses an old CSF name, or `undefined` if the title
 * is current. `CSF Next` is now `CSF 4`. Svelte titles drop the `Svelte` prefix: `Svelte CSF` is
 * now `CSF 3`, and `Svelte CSF 3` and `Svelte CSF 4` are now `CSF 3` and `CSF 4`.
 */
export function getRenamedCsfTabTitle(tabTitle = ''): string | undefined {
  const renamed = tabTitle
    .replace(/CSF Next( 🧪)?/, 'CSF 4')
    .replace(/^Svelte CSF( [34])?$/, (_, version = ' 3') => `CSF${version}`);
  return renamed === tabTitle ? undefined : renamed;
}

/**
 * Returns the segments whose `tabTitle` uses an old CSF name.
 */
export function getLegacyCsfTitleSegments(lines: string[]): SnippetSegment[] {
  return getSnippetSegments(lines).filter(({ attributes }) =>
    getRenamedCsfTabTitle(attributes.tabTitle)
  );
}

const CSF3_DEPRECATION_MESSAGE =
  '⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4';

/**
 * Returns the deprecation comment a CSF 3 segment must start with, in the comment syntax of the
 * segment's language.
 */
export function getCsf3DeprecationComment(syntax: string): string {
  if (['svelte', 'html', 'vue'].includes(syntax)) return `<!-- ${CSF3_DEPRECATION_MESSAGE} -->`;
  if (syntax === 'mdx') return `{/* ${CSF3_DEPRECATION_MESSAGE} */}`;
  return `// ${CSF3_DEPRECATION_MESSAGE}`;
}

/**
 * Returns the CSF 3 segments whose first line is not the deprecation comment.
 */
export function getCsf3SegmentsWithoutDeprecation(lines: string[]): SnippetSegment[] {
  return getCsfSegments(getSnippetSegments(lines))
    .filter(({ version }) => version === 'csf3')
    .map(({ segment }) => segment)
    .filter(
      (segment) => lines[segment.fenceLine + 1] !== getCsf3DeprecationComment(segment.syntax)
    );
}

/**
 * Adds the deprecation comment as the first line of each CSF 3 segment that lacks it.
 * Returns the updated lines, or `undefined` if nothing changed.
 */
export function addCsf3Deprecation(lines: string[]): string[] | undefined {
  const segments = getCsf3SegmentsWithoutDeprecation(lines);
  if (segments.length === 0) return undefined;

  const result = [...lines];
  for (const segment of segments.reverse()) {
    result.splice(segment.fenceLine + 1, 0, getCsf3DeprecationComment(segment.syntax));
  }
  return result;
}
