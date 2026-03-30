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
