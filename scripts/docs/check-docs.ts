import path from 'path';
import fs from 'node:fs/promises';
import { getMdxFiles, readFileLines, getHeadingSlugs, getLineContexts } from './utils';
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
export interface DocLineError {
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
    await Promise.all(
      lines.map(async (line, idx) => {
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
      })
    );
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
    await Promise.all(
      lines.map(async (line, idx) => {
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
      })
    );
  }
  return errors;
}

/**
 * Checks for deprecated <IfRenderer> usage in .mdx files.
 */
export async function checkDeprecatedIfRenderer(
  docsDir: string
): Promise<DeprecatedIfRendererError[]> {
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
 * Checks for H1 headings (# ) in the body of .mdx files.
 * H1 should only come from frontmatter title.
 */
export async function checkNoBodyH1(docsDir: string): Promise<DocLineError[]> {
  const mdxFiles = await getMdxFiles(docsDir);
  const errors: DocLineError[] = [];

  for (const file of mdxFiles) {
    const lines = await readFileLines(file);
    const contexts = getLineContexts(lines);
    lines.forEach((line, idx) => {
      if (contexts[idx] === 'content' && /^#\s+/.test(line)) {
        errors.push({
          file,
          line: idx + 1,
          message: 'H1 heading found in body. Use frontmatter "title" instead.',
        });
      }
    });
  }
  return errors;
}

/**
 * Checks for skipped heading levels (e.g. ## followed by ####).
 */
export async function checkHeadingHierarchy(docsDir: string): Promise<DocLineError[]> {
  const mdxFiles = await getMdxFiles(docsDir);
  const errors: DocLineError[] = [];
  const headingRegex = /^(#{2,6})\s+/;

  for (const file of mdxFiles) {
    const lines = await readFileLines(file);
    const contexts = getLineContexts(lines);
    let prevLevel = 1; // Assume H1 from frontmatter title

    for (let i = 0; i < lines.length; i++) {
      if (contexts[i] !== 'content') continue;
      const match = headingRegex.exec(lines[i]);
      const htmlMatch = !match ? lines[i].match(/<h([2-6])\b/) : null;
      if (!match && !htmlMatch) continue;
      const level = match ? match[1].length : Number(htmlMatch![1]);
      if (level > prevLevel + 1) {
        errors.push({
          file,
          line: i + 1,
          message: `Skipped heading level: jumped from H${prevLevel} to H${level}.`,
        });
      }
      prevLevel = level;
    }
  }
  return errors;
}

/**
 * Checks for non-standard variant="positive" on Callout components.
 */
export async function checkCalloutVariantPositive(docsDir: string): Promise<DocLineError[]> {
  const mdxFiles = await getMdxFiles(docsDir);
  const errors: DocLineError[] = [];

  for (const file of mdxFiles) {
    const lines = await readFileLines(file);
    lines.forEach((line, idx) => {
      if (/variant=["']positive["']/.test(line)) {
        errors.push({
          file,
          line: idx + 1,
          message: 'Non-standard variant="positive". Use variant="info" instead.',
        });
      }
    });
  }
  return errors;
}

/**
 * Checks for ⚠️ icon used with variant="info" on Callout components.
 * The ⚠️ icon should only be used with variant="warning".
 */
export async function checkCalloutIconMismatch(docsDir: string): Promise<DocLineError[]> {
  const mdxFiles = await getMdxFiles(docsDir);
  const errors: DocLineError[] = [];

  for (const file of mdxFiles) {
    const lines = await readFileLines(file);
    lines.forEach((line, idx) => {
      if (/<Callout\b/.test(line) && line.includes('⚠️') && /variant=["']info["']/.test(line)) {
        errors.push({
          file,
          line: idx + 1,
          message: '⚠️ icon should use variant="warning", not variant="info".',
        });
      }
    });
  }
  return errors;
}

/**
 * Checks for unnecessarily quoted frontmatter title values.
 * Quotes are only needed when the value contains special characters.
 */
export async function checkFrontmatterQuotes(docsDir: string): Promise<DocLineError[]> {
  const mdxFiles = await getMdxFiles(docsDir);
  const errors: DocLineError[] = [];
  const specialChars = /[&|:,]/;

  for (const file of mdxFiles) {
    const lines = await readFileLines(file);
    const contexts = getLineContexts(lines);
    for (let i = 0; i < lines.length; i++) {
      if (contexts[i] !== 'frontmatter') continue;
      const match = lines[i].match(/^title:\s*(["'])(.+)\1\s*$/);
      if (match) {
        const value = match[2];
        if (!specialChars.test(value)) {
          errors.push({
            file,
            line: i + 1,
            message: `Frontmatter "title" is unnecessarily quoted. Remove quotes.`,
          });
        }
      }
    }
  }
  return errors;
}

/**
 * Checks for redundant sidebar.title that matches the page title.
 */
export async function checkRedundantSidebarTitle(docsDir: string): Promise<DocLineError[]> {
  const mdxFiles = await getMdxFiles(docsDir);
  const errors: DocLineError[] = [];

  for (const file of mdxFiles) {
    const lines = await readFileLines(file);
    const contexts = getLineContexts(lines);

    let title = '';
    let sidebarTitle = '';
    let sidebarTitleLine = -1;

    for (let i = 0; i < lines.length; i++) {
      if (contexts[i] !== 'frontmatter') continue;
      const titleMatch = lines[i].match(/^title:\s*(.+)$/);
      if (titleMatch) {
        title = titleMatch[1].replace(/^["']|["']$/g, '').trim();
      }
      const sidebarMatch = lines[i].match(/^\s+title:\s*(.+)$/);
      if (sidebarMatch) {
        sidebarTitle = sidebarMatch[1].replace(/^["']|["']$/g, '').trim();
        sidebarTitleLine = i + 1;
      }
    }

    if (title && sidebarTitle && title === sidebarTitle && sidebarTitleLine > 0) {
      errors.push({
        file,
        line: sidebarTitleLine,
        message: `Redundant sidebar.title (matches title). Remove it.`,
      });
    }
  }
  return errors;
}

/**
 * Checks for bare URLs (not wrapped in markdown link syntax) in prose.
 */
export async function checkBareUrls(docsDir: string): Promise<DocLineError[]> {
  const mdxFiles = await getMdxFiles(docsDir);
  const errors: DocLineError[] = [];

  for (const file of mdxFiles) {
    const lines = await readFileLines(file);
    const contexts = getLineContexts(lines);

    for (let i = 0; i < lines.length; i++) {
      if (contexts[i] !== 'content') continue;
      const line = lines[i];
      // Skip import/export lines
      if (/^(import|export)\s/.test(line)) continue;
      // Skip markdown reference link definitions: [label]: URL
      if (/^\[[^\]]+\]:\s/.test(line)) continue;
      // Skip markdown table rows
      if (/^\|/.test(line)) continue;

      // Find all URLs in the line
      const urlRegex = /https?:\/\/[^\s)>\]]+/g;
      let match;
      while ((match = urlRegex.exec(line))) {
        const start = match.index;

        // Check if inside markdown link syntax: [text](url) or ](url)
        if (start > 0 && line[start - 1] === '(') {
          const before = line.slice(0, start - 1);
          if (/\[[^\]]*\]$/.test(before)) continue;
        }

        // Check if inside angle brackets: <url>
        if (start > 0 && line[start - 1] === '<') continue;

        // Check if inside backticks
        const beforeUrl = line.slice(0, start);
        const backtickCount = (beforeUrl.match(/`/g) || []).length;
        if (backtickCount % 2 === 1) continue;

        // Check if inside JSX prop value: ="url" or ={'url'}
        if (start >= 2 && /=["'{]$/.test(line.slice(Math.max(0, start - 2), start))) continue;
        if (start >= 1 && /["']$/.test(line.slice(start - 1, start))) {
          const priorChunk = line.slice(0, start);
          if (/=["'{]?["']?$/.test(priorChunk)) continue;
        }

        // Check if it's a JSX src/href/id prop
        if (/(?:src|href|id)=["']$/.test(line.slice(Math.max(0, start - 6), start))) continue;

        errors.push({
          file,
          line: i + 1,
          message: `Bare URL found. Wrap in markdown link syntax: [text](url)`,
        });
      }
    }
  }
  return errors;
}

/**
 * Runs all checks and prints a summary. Exits 1 if any errors are found.
 */
export async function runAllChecks(docsDir: string) {
  const [
    rel,
    snippets,
    deprecated,
    callout,
    bodyH1,
    headingHierarchy,
    variantPositive,
    iconMismatch,
    fmQuotes,
    redundantSidebar,
    bareUrls,
  ] = await Promise.all([
    checkRelativeLinks(docsDir),
    checkCodeSnippetPaths(docsDir),
    checkDeprecatedIfRenderer(docsDir),
    checkCalloutVariant(docsDir),
    checkNoBodyH1(docsDir),
    checkHeadingHierarchy(docsDir),
    checkCalloutVariantPositive(docsDir),
    checkCalloutIconMismatch(docsDir),
    checkFrontmatterQuotes(docsDir),
    checkRedundantSidebarTitle(docsDir),
    checkBareUrls(docsDir),
  ]);
  const all = [
    ...rel.map((e) => ({ ...e, type: 'relative-link' })),
    ...snippets.map((e) => ({ ...e, type: 'snippet-path' })),
    ...deprecated.map((e) => ({ ...e, type: 'deprecated-if-renderer' })),
    ...callout.map((e) => ({ ...e, type: 'callout-variant' })),
    ...bodyH1.map((e) => ({ ...e, type: 'body-h1' })),
    ...headingHierarchy.map((e) => ({ ...e, type: 'heading-hierarchy' })),
    ...variantPositive.map((e) => ({ ...e, type: 'callout-variant-positive' })),
    ...iconMismatch.map((e) => ({ ...e, type: 'callout-icon-mismatch' })),
    ...fmQuotes.map((e) => ({ ...e, type: 'frontmatter-quotes' })),
    ...redundantSidebar.map((e) => ({ ...e, type: 'redundant-sidebar-title' })),
    ...bareUrls.map((e) => ({ ...e, type: 'bare-url' })),
  ];
  if (all.length === 0) {
    console.log('✅ Docs check: no errors found.');
    return;
  }
  const typeLabels: Record<string, string> = {
    'relative-link': 'RelativeLink',
    'snippet-path': 'CodeSnippetPath',
    'deprecated-if-renderer': 'IfRenderer',
    'callout-variant': 'CalloutVariant',
    'body-h1': 'BodyH1',
    'heading-hierarchy': 'HeadingHierarchy',
    'callout-variant-positive': 'CalloutVariantPositive',
    'callout-icon-mismatch': 'CalloutIconMismatch',
    'frontmatter-quotes': 'FrontmatterQuotes',
    'redundant-sidebar-title': 'RedundantSidebarTitle',
    'bare-url': 'BareUrl',
  };
  for (const err of all) {
    const loc = `${err.file}:${err.line}`;
    const label = typeLabels[err.type] || err.type;
    console.error(`[${label}] ${loc}: ${err.message}`);
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
