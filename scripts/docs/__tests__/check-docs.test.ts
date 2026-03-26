import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'path';
import os from 'os';
import {
  checkRelativeLinks,
  checkCodeSnippetPaths,
  checkDeprecatedIfRenderer,
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

  describe('runAllChecks', () => {
    it('passes for clean docs', async () => {
      await writeFile(path.join(docsDir, 'foo.mdx'), '# Foo');
      await writeFile(path.join(snippetsDir, 'foo.md'), 'snippet');
      await writeFile(path.join(docsDir, 'bar.mdx'), '[link](./foo.mdx)\n<CodeSnippets path="foo.md" />\n<If>ok</If>');
      await expect(runAllChecks(docsDir)).resolves.toBeUndefined();
    });
    it('aggregates mixed errors', async () => {
      await writeFile(path.join(docsDir, 'badlink.mdx'), '[link](./missing.mdx)');
      await writeFile(path.join(docsDir, 'badcode.mdx'), '<CodeSnippets path="missing.md" />');
      await writeFile(path.join(docsDir, 'badif.mdx'), '<IfRenderer>bad</IfRenderer>');
      let error;
      try {
        await runAllChecks(docsDir);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
    });
  });
});
