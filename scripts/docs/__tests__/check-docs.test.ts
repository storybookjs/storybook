import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'path';
import os from 'os';
import {
  checkRelativeLinks,
  checkCodeSnippetPaths,
  checkDeprecatedIfRenderer,
  checkCalloutVariant,
  checkNoBodyH1,
  checkHeadingHierarchy,
  checkCalloutVariantPositive,
  checkCalloutIconMismatch,
  checkFrontmatterQuotes,
  checkRedundantSidebarTitle,
  checkBareUrls,
  runAllChecks,
} from '../check-docs';

async function writeFile(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

describe('check-docs', () => {
  let tmpDir: string;
  let docsDir: string;
  let snippetsDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-check-'));
    docsDir = path.join(tmpDir, 'docs');
    snippetsDir = path.join(docsDir, '_snippets');
    await fs.mkdir(snippetsDir, { recursive: true });
  });

  describe('checkRelativeLinks', () => {
    it('passes for valid relative links', async () => {
      const target = path.join(docsDir, 'foo.mdx');
      await writeFile(target, '# Foo');
      await writeFile(path.join(docsDir, 'bar.mdx'), '[link](./foo.mdx)');
      const errors = await checkRelativeLinks(docsDir);
      expect(errors).toEqual([]);
    });
    it('errors for broken relative links', async () => {
      await writeFile(path.join(docsDir, 'bar.mdx'), '[link](./missing.mdx)');
      const errors = await checkRelativeLinks(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].link).toContain('missing.mdx');
    });
    it('passes for links with #anchor to existing heading', async () => {
      const target = path.join(docsDir, 'foo.mdx');
      await writeFile(target, '## My section\n\nContent here.');
      await writeFile(path.join(docsDir, 'bar.mdx'), '[link](./foo.mdx#my-section)');
      const errors = await checkRelativeLinks(docsDir);
      expect(errors).toEqual([]);
    });
    it('errors for links with #anchor to non-existent heading', async () => {
      const target = path.join(docsDir, 'foo.mdx');
      await writeFile(target, '## Existing heading\n\nContent here.');
      await writeFile(path.join(docsDir, 'bar.mdx'), '[link](./foo.mdx#non-existent)');
      const errors = await checkRelativeLinks(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('Broken fragment');
      expect(errors[0].message).toContain('#non-existent');
    });
    it('passes for links with #anchor to heading containing inline code', async () => {
      const target = path.join(docsDir, 'foo.mdx');
      await writeFile(target, '### `Story.test`\n\nContent here.');
      await writeFile(path.join(docsDir, 'bar.mdx'), '[link](./foo.mdx#storytest)');
      const errors = await checkRelativeLinks(docsDir);
      expect(errors).toEqual([]);
    });
    it('passes for links with #anchor to heading containing escaped HTML', async () => {
      const target = path.join(docsDir, 'foo.mdx');
      await writeFile(target, '## Adding to \\<head>\n\nContent here.');
      await writeFile(path.join(docsDir, 'bar.mdx'), '[link](./foo.mdx#adding-to-head)');
      const errors = await checkRelativeLinks(docsDir);
      expect(errors).toEqual([]);
    });
    it('passes for links with #anchor to heading containing markdown links', async () => {
      const target = path.join(docsDir, 'foo.mdx');
      const other = path.join(docsDir, 'other.mdx');
      await writeFile(other, '# Other');
      await writeFile(target, '### [Interaction tests](./other.mdx)\n\nContent here.');
      await writeFile(path.join(docsDir, 'bar.mdx'), '[link](./foo.mdx#interaction-tests)');
      const errors = await checkRelativeLinks(docsDir);
      expect(errors).toEqual([]);
    });
    it('ignores absolute/external links', async () => {
      await writeFile(path.join(docsDir, 'bar.mdx'), '[google](https://google.com)');
      const errors = await checkRelativeLinks(docsDir);
      expect(errors).toEqual([]);
    });
    it('ignores cross-version links to other release branches', async () => {
      await writeFile(
        path.join(docsDir, 'sub', 'bar.mdx'),
        '[old docs](../../../release-8-6/docs/migration-guide/index.mdx)\n[older docs](../../../release-6-5/docs/configure/babel.mdx)'
      );
      const errors = await checkRelativeLinks(docsDir);
      expect(errors).toEqual([]);
    });
  });

  describe('checkCodeSnippetPaths', () => {
    it('passes for valid snippet path', async () => {
      await writeFile(path.join(snippetsDir, 'foo.md'), 'snippet');
      await writeFile(path.join(docsDir, 'bar.mdx'), '<CodeSnippets path="foo.md" />');
      const errors = await checkCodeSnippetPaths(docsDir);
      expect(errors).toEqual([]);
    });
    it('errors for missing snippet path', async () => {
      await writeFile(path.join(docsDir, 'bar.mdx'), '<CodeSnippets path="missing.md" />');
      const errors = await checkCodeSnippetPaths(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].path).toBe('missing.md');
    });
  });

  describe('checkDeprecatedIfRenderer', () => {
    it('passes for <If> usage', async () => {
      await writeFile(path.join(docsDir, 'foo.mdx'), '<If>content</If>');
      const errors = await checkDeprecatedIfRenderer(docsDir);
      expect(errors).toEqual([]);
    });
    it('errors for <IfRenderer> usage', async () => {
      await writeFile(path.join(docsDir, 'foo.mdx'), '<IfRenderer>bad</IfRenderer>');
      const errors = await checkDeprecatedIfRenderer(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('Deprecated <IfRenderer>');
    });
  });

  describe('checkCalloutVariant', () => {
    it('passes for <Callout variant="info">', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '<Callout variant="info">\n\nContent\n\n</Callout>'
      );
      const errors = await checkCalloutVariant(docsDir);
      expect(errors).toEqual([]);
    });
    it('errors for bare <Callout>', async () => {
      await writeFile(path.join(docsDir, 'foo.mdx'), '<Callout>\n\nContent\n\n</Callout>');
      const errors = await checkCalloutVariant(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('missing variant prop');
    });
    it('errors for <Callout icon="💡"> without variant', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '<Callout icon="💡">\n\nContent\n\n</Callout>'
      );
      const errors = await checkCalloutVariant(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('missing variant prop');
    });
  });

  describe('checkNoBodyH1', () => {
    it('passes when no H1 in body', async () => {
      await writeFile(path.join(docsDir, 'foo.mdx'), '---\ntitle: Foo\n---\n\n## Section');
      const errors = await checkNoBodyH1(docsDir);
      expect(errors).toEqual([]);
    });
    it('errors for H1 in body', async () => {
      await writeFile(path.join(docsDir, 'foo.mdx'), '---\ntitle: Foo\n---\n\n# Bad heading');
      const errors = await checkNoBodyH1(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('H1 heading found in body');
    });
    it('ignores H1 inside code blocks', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '---\ntitle: Foo\n---\n\n```md\n# This is fine\n```'
      );
      const errors = await checkNoBodyH1(docsDir);
      expect(errors).toEqual([]);
    });
  });

  describe('checkHeadingHierarchy', () => {
    it('passes for sequential heading levels', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '---\ntitle: Foo\n---\n\n## H2\n\n### H3\n\n#### H4'
      );
      const errors = await checkHeadingHierarchy(docsDir);
      expect(errors).toEqual([]);
    });
    it('errors when skipping heading levels', async () => {
      await writeFile(path.join(docsDir, 'foo.mdx'), '---\ntitle: Foo\n---\n\n## H2\n\n#### H4');
      const errors = await checkHeadingHierarchy(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('jumped from H2 to H4');
    });
    it('ignores headings inside code blocks', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '---\ntitle: Foo\n---\n\n## H2\n\n```md\n#### H4\n```\n\n### H3'
      );
      const errors = await checkHeadingHierarchy(docsDir);
      expect(errors).toEqual([]);
    });
  });

  describe('checkCalloutVariantPositive', () => {
    it('passes for standard variants', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '<Callout variant="info">\n\nContent\n\n</Callout>'
      );
      const errors = await checkCalloutVariantPositive(docsDir);
      expect(errors).toEqual([]);
    });
    it('errors for variant="positive"', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '<Callout variant="positive">\n\nContent\n\n</Callout>'
      );
      const errors = await checkCalloutVariantPositive(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('variant="positive"');
    });
  });

  describe('checkCalloutIconMismatch', () => {
    it('passes for ⚠️ with variant="warning"', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '<Callout variant="warning" icon="⚠️">\n\nContent\n\n</Callout>'
      );
      const errors = await checkCalloutIconMismatch(docsDir);
      expect(errors).toEqual([]);
    });
    it('errors for ⚠️ with variant="info"', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '<Callout variant="info" icon="⚠️">\n\nContent\n\n</Callout>'
      );
      const errors = await checkCalloutIconMismatch(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('⚠️');
    });
  });

  describe('checkFrontmatterQuotes', () => {
    it('passes for unquoted title', async () => {
      await writeFile(path.join(docsDir, 'foo.mdx'), '---\ntitle: My page\n---\n\nContent');
      const errors = await checkFrontmatterQuotes(docsDir);
      expect(errors).toEqual([]);
    });
    it('passes for quoted title with special characters', async () => {
      await writeFile(path.join(docsDir, 'foo.mdx'), '---\ntitle: "Props & Args"\n---\n\nContent');
      const errors = await checkFrontmatterQuotes(docsDir);
      expect(errors).toEqual([]);
    });
    it('errors for unnecessarily quoted title', async () => {
      await writeFile(path.join(docsDir, 'foo.mdx'), '---\ntitle: "ArgTypes"\n---\n\nContent');
      const errors = await checkFrontmatterQuotes(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('unnecessarily quoted');
    });
  });

  describe('checkRedundantSidebarTitle', () => {
    it('passes when sidebar.title differs from title', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '---\ntitle: Component Story Format (CSF)\nsidebar:\n  title: CSF\n---\n\nContent'
      );
      const errors = await checkRedundantSidebarTitle(docsDir);
      expect(errors).toEqual([]);
    });
    it('errors when sidebar.title matches title', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '---\ntitle: ArgTypes\nsidebar:\n  title: ArgTypes\n---\n\nContent'
      );
      const errors = await checkRedundantSidebarTitle(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('Redundant sidebar.title');
    });
    it('passes when no sidebar.title exists', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '---\ntitle: ArgTypes\nsidebar:\n  order: 1\n---\n\nContent'
      );
      const errors = await checkRedundantSidebarTitle(docsDir);
      expect(errors).toEqual([]);
    });
  });

  describe('checkBareUrls', () => {
    it('passes for URLs in markdown link syntax', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '---\ntitle: Foo\n---\n\n[link](https://example.com)'
      );
      const errors = await checkBareUrls(docsDir);
      expect(errors).toEqual([]);
    });
    it('errors for bare URLs in prose', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '---\ntitle: Foo\n---\n\nVisit https://example.com for details.'
      );
      const errors = await checkBareUrls(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('Bare URL');
    });
    it('ignores URLs in code blocks', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '---\ntitle: Foo\n---\n\n```\nhttps://example.com\n```'
      );
      const errors = await checkBareUrls(docsDir);
      expect(errors).toEqual([]);
    });
    it('ignores URLs in backticks', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '---\ntitle: Foo\n---\n\nRun `https://example.com` in browser.'
      );
      const errors = await checkBareUrls(docsDir);
      expect(errors).toEqual([]);
    });
    it('ignores URLs in import statements', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '---\ntitle: Foo\n---\n\nimport Foo from "https://example.com"'
      );
      const errors = await checkBareUrls(docsDir);
      expect(errors).toEqual([]);
    });
    it('ignores URLs in JSX props', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '---\ntitle: Foo\n---\n\n<Video src="https://example.com/video.mp4" />'
      );
      const errors = await checkBareUrls(docsDir);
      expect(errors).toEqual([]);
    });
  });

  describe('runAllChecks', () => {
    it('passes for clean docs', async () => {
      await writeFile(path.join(docsDir, 'foo.mdx'), '---\ntitle: Foo\n---\n\n## Section');
      await writeFile(path.join(snippetsDir, 'foo.md'), 'snippet');
      await writeFile(
        path.join(docsDir, 'bar.mdx'),
        '---\ntitle: Bar\n---\n\n[link](./foo.mdx)\n<CodeSnippets path="foo.md" />\n<If>ok</If>'
      );
      await expect(runAllChecks(docsDir)).resolves.toBeUndefined();
    });
    it('aggregates mixed errors', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await writeFile(path.join(docsDir, 'badlink.mdx'), '[link](./missing.mdx)');
      await writeFile(path.join(docsDir, 'badcode.mdx'), '<CodeSnippets path="missing.md" />');
      await writeFile(path.join(docsDir, 'badif.mdx'), '<IfRenderer>bad</IfRenderer>');

      await runAllChecks(docsDir);

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockError).toHaveBeenCalled();

      mockExit.mockRestore();
      mockError.mockRestore();
    });
  });
});
