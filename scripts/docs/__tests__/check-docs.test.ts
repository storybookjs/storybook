import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'path';
import os from 'os';
import {
  checkRelativeLinks,
  checkCodeSnippetPaths,
  checkDeprecatedIfRenderer,
  checkCalloutVariant,
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
    it('passes for links with #anchor to existing file', async () => {
      const target = path.join(docsDir, 'foo.mdx');
      await writeFile(target, '# Foo');
      await writeFile(path.join(docsDir, 'bar.mdx'), '[link](./foo.mdx#section)');
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
      await writeFile(path.join(docsDir, 'foo.mdx'), '<Callout variant="info">\n\nContent\n\n</Callout>');
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
      await writeFile(path.join(docsDir, 'foo.mdx'), '<Callout icon="💡">\n\nContent\n\n</Callout>');
      const errors = await checkCalloutVariant(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('missing variant prop');
    });
  });

  describe('runAllChecks', () => {
    it('passes for clean docs', async () => {
      await writeFile(path.join(docsDir, 'foo.mdx'), '# Foo');
      await writeFile(path.join(snippetsDir, 'foo.md'), 'snippet');
      await writeFile(path.join(docsDir, 'bar.mdx'), '[link](./foo.mdx)\n<CodeSnippets path="foo.md" />\n<If>ok</If>');
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
