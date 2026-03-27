import path from 'path';
import fs from 'node:fs/promises';
import { getMdxFiles, readFileLines, getHeadingSlugs } from './utils';
import { esMain } from '../utils/esmain';

export interface RelativeLinkError {
  file: string;
  line: number;
  link: string;
  message: string;
}
export interface CodeSnippetPathError {
  file: string;
  line: number;
  path: string;
  message: string;
}
export interface DeprecatedIfRendererError {
  file: string;
  line: number;
  message: string;
}
export interface CalloutVariantError {
  file: string;
  line: number;
  message: string;
}

/**
 * Checks all relative links in .mdx files for broken targets.
 */
export async function checkRelativeLinks(docsDir: string): Promise<RelativeLinkError[]> {
  const mdxFiles = await getMdxFiles(docsDir);
  const errors: RelativeLinkError[] = [];
  // Cross-version links point to docs on other release branches (e.g. ../../../release-8-6/docs/...)
  // and cannot be validated locally
  const crossVersionRegex = /^(?:\.\.\/)+release-[\w.-]+\//;

  // Cache heading slugs per target file to avoid re-reading
  const slugCache = new Map<string, Set<string>>();

  for (const file of mdxFiles) {
    const lines = await readFileLines(file);
    await Promise.all(lines.map(async (line, idx) => {
      // Create a new regex per line to avoid shared lastIndex state across concurrent promises
      const relLinkRegex = /\[[^\]]+\]\(((\.\.?\/)[^\)#]+)(#[^)]*)?\)/g;
      let match;
      while ((match = relLinkRegex.exec(line))) {
        const relPath = match[1];
        const anchor = match[3];
        if (crossVersionRegex.test(relPath)) continue;
        const targetPath = path.resolve(path.dirname(file), relPath);
        try {
          await fs.access(targetPath);
        } catch {
          errors.push({
            file,
            line: idx + 1,
            link: match[0],
            message: `Broken relative link: ${relPath}${anchor || ''}`,
          });
          continue;
        }
        // Validate the fragment if present
        if (anchor) {
          const fragment = anchor.slice(1); // Remove leading #
          if (!slugCache.has(targetPath)) {
            slugCache.set(targetPath, await getHeadingSlugs(targetPath));
          }
          const slugs = slugCache.get(targetPath)!;
          if (!slugs.has(fragment)) {
            errors.push({
              file,
              line: idx + 1,
              link: match[0],
              message: `Broken fragment: ${relPath}${anchor} (heading "#${fragment}" not found in target)`,
            });
          }
        }
      }
    }));
  }
  return errors;
}

/**
 * Checks all <CodeSnippets path="..." /> usages for missing snippet files.
 */
export async function checkCodeSnippetPaths(docsDir: string): Promise<CodeSnippetPathError[]> {
  const mdxFiles = await getMdxFiles(docsDir);
  const errors: CodeSnippetPathError[] = [];
  const snippetRegex = /<CodeSnippets\s+path=["']([^"']+)["']/g;
  const snippetsDir = path.join(docsDir, '_snippets');

  for (const file of mdxFiles) {
    const lines = await readFileLines(file);
    await Promise.all(lines.map(async (line, idx) => {
      let match;
      while ((match = snippetRegex.exec(line))) {
        const snippetPath = match[1];
        const fullPath = path.join(snippetsDir, snippetPath);
        try {
          await fs.access(fullPath);
        } catch {
          errors.push({
            file,
            line: idx + 1,
            path: snippetPath,
            message: `Missing snippet: ${snippetPath}`,
          });
        }
      }
    }));
  }
  return errors;
}

/**
 * Checks for deprecated <IfRenderer> usage in .mdx files.
 */
export async function checkDeprecatedIfRenderer(docsDir: string): Promise<DeprecatedIfRendererError[]> {
  const mdxFiles = await getMdxFiles(docsDir);
  const errors: DeprecatedIfRendererError[] = [];
  const ifRendererRegex = /<IfRenderer\b/g;

  for (const file of mdxFiles) {
    const lines = await readFileLines(file);
    lines.forEach((line, idx) => {
      if (ifRendererRegex.test(line)) {
        errors.push({
          file,
          line: idx + 1,
          message: 'Deprecated <IfRenderer> usage. Use <If> instead.',
        });
      }
    });
  }
  return errors;
}

/**
 * Checks for <Callout> tags missing a variant prop.
 */
export async function checkCalloutVariant(docsDir: string): Promise<CalloutVariantError[]> {
  const mdxFiles = await getMdxFiles(docsDir);
  const errors: CalloutVariantError[] = [];
  const calloutOpenRegex = /<Callout\b/;

  for (const file of mdxFiles) {
    const lines = await readFileLines(file);
    lines.forEach((line, idx) => {
      if (calloutOpenRegex.test(line) && !line.includes('variant=')) {
        errors.push({
          file,
          line: idx + 1,
          message: '<Callout> missing variant prop. Use variant="info" or variant="warning".',
        });
      }
    });
  }
  return errors;
}

/**
 * Runs all checks and prints a summary. Exits 1 if any errors are found.
 */
export async function runAllChecks(docsDir: string) {
  const [rel, snippets, deprecated, callout] = await Promise.all([
    checkRelativeLinks(docsDir),
    checkCodeSnippetPaths(docsDir),
    checkDeprecatedIfRenderer(docsDir),
    checkCalloutVariant(docsDir),
  ]);
  const all = [
    ...rel.map(e => ({ ...e, type: 'relative-link' })),
    ...snippets.map(e => ({ ...e, type: 'snippet-path' })),
    ...deprecated.map(e => ({ ...e, type: 'deprecated-if-renderer' })),
    ...callout.map(e => ({ ...e, type: 'callout-variant' })),
  ];
  if (all.length === 0) {
    console.log('✅ Docs check: no errors found.');
    return;
  }
  for (const err of all) {
    const loc = `${err.file}:${err.line}`;
    if (err.type === 'relative-link') {
      console.error(`[RelativeLink] ${loc}: ${err.message}`);
    } else if (err.type === 'snippet-path') {
      console.error(`[CodeSnippetPath] ${loc}: ${err.message}`);
    } else if (err.type === 'deprecated-if-renderer') {
      console.error(`[IfRenderer] ${loc}: ${err.message}`);
    } else if (err.type === 'callout-variant') {
      console.error(`[CalloutVariant] ${loc}: ${err.message}`);
    }
  }
  console.error(`\n❌ Docs check: ${all.length} error(s) found.`);
  process.exit(1);
}

// CLI entry point
if (esMain(import.meta.url)) {
  runAllChecks(path.resolve(__dirname, '../../docs')).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
