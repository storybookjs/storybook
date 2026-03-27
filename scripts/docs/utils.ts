// eslint-disable-next-line depend/ban-dependencies
import fg from 'fast-glob';
import fs from 'node:fs/promises';

/**
 * Recursively collects all .mdx files in the given docs directory.
 */
export async function getMdxFiles(docsDir: string): Promise<string[]> {
  return fg(['**/*.mdx'], { cwd: docsDir, absolute: true });
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
