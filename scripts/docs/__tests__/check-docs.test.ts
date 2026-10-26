import fs from 'node:fs/promises';
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkBareUrls,
  checkCalloutIconMismatch,
  checkCalloutVariant,
  checkCalloutVariantPositive,
  checkCodeSnippetPaths,
  checkDeprecatedIfRenderer,
  checkFrontmatterQuotes,
  checkHeadingHierarchy,
  checkNoBodyH1,
  checkRedundantSidebarTitle,
  checkRelativeLinks,
  checkSnippetCsf3Deprecation,
  checkSnippetCsfOrder,
  checkSnippetLegacyCsfTitle,
  runAllChecks,
} from '../check-docs';
import { fixSnippets } from '../fix-snippets';

const CSF3_DEPRECATION_COMMENT =
  '// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4';

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
    it('passes for multi-line <Callout> with variant on a subsequent line', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '<Callout\n  variant="info"\n  icon="💡"\n>\n\nContent\n\n</Callout>'
      );
      const errors = await checkCalloutVariant(docsDir);
      expect(errors).toEqual([]);
    });
    it('errors for multi-line <Callout> without variant', async () => {
      await writeFile(
        path.join(docsDir, 'foo.mdx'),
        '<Callout\n  icon="💡"\n>\n\nContent\n\n</Callout>'
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

  describe('checkSnippetCsfOrder', () => {
    const block = (attrs: string, body = 'code') => `\`\`\`ts ${attrs}\n${body}\n\`\`\``;
    // CSF 3 blocks include the deprecation comment, so the fixer only changes their order here
    const csf3 = (renderer = 'react', language = 'ts', title = 'CSF 3') =>
      block(
        `renderer="${renderer}" language="${language}" tabTitle="${title}"`,
        `${CSF3_DEPRECATION_COMMENT}\n${renderer} ${title}`
      );
    const csf4 = (renderer = 'react', language = 'ts', title = 'CSF 4') =>
      block(
        `renderer="${renderer}" language="${language}" tabTitle="${title}"`,
        `${renderer} ${title}`
      );

    it('passes when CSF 4 comes first', async () => {
      await writeFile(path.join(snippetsDir, 'foo.md'), [csf4(), csf3()].join('\n\n'));
      const errors = await checkSnippetCsfOrder(docsDir);
      expect(errors).toEqual([]);
    });
    it('errors when CSF 3 comes first', async () => {
      await writeFile(path.join(snippetsDir, 'foo.md'), [csf3(), csf4()].join('\n\n'));
      const errors = await checkSnippetCsfOrder(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].line).toBe(1);
      expect(errors[0].message).toContain('CSF 3 snippet comes before its CSF 4 snippet');
    });
    it('compares only blocks with the same renderer and language', async () => {
      await writeFile(
        path.join(snippetsDir, 'foo.md'),
        [csf3('vue'), csf4('react'), csf3('react', 'js'), csf4('react', 'ts')].join('\n\n')
      );
      const errors = await checkSnippetCsfOrder(docsDir);
      expect(errors).toEqual([]);
    });
    it('pairs titles that share a base, like "Head (CSF 3)"', async () => {
      await writeFile(
        path.join(snippetsDir, 'foo.md'),
        [
          csf3('react', 'ts', 'Head (CSF 3)'),
          csf4('react', 'ts', 'Body (CSF 4)'),
          csf4('react', 'ts', 'Head (CSF 4)'),
        ].join('\n\n')
      );
      const errors = await checkSnippetCsfOrder(docsDir);
      expect(errors.length).toBe(1);
    });
    it('errors when a common CSF 3 block comes before a renderer CSF 4 block', async () => {
      await writeFile(
        path.join(snippetsDir, 'foo.md'),
        [csf3('common'), csf4('react')].join('\n\n')
      );
      const errors = await checkSnippetCsfOrder(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].line).toBe(1);
    });
    it('fixes the order across common and renderer blocks', async () => {
      const file = path.join(snippetsDir, 'foo.md');
      await writeFile(
        file,
        [csf3('common'), csf4('react'), csf4('vue'), block('renderer="svelte"'), ''].join('\n\n')
      );

      await fixSnippets(docsDir);

      expect(await fs.readFile(file, 'utf8')).toBe(
        [csf4('react'), csf4('vue'), csf3('common'), block('renderer="svelte"'), ''].join('\n\n')
      );
      expect(await checkSnippetCsfOrder(docsDir)).toEqual([]);
    });
    it('does not move blocks that are in order in every view', async () => {
      // A common block links the svelte and react blocks into one group, but each view is in order
      const content = [csf4('svelte'), csf3('svelte'), csf4('react'), csf3('common'), ''].join(
        '\n\n'
      );
      const file = path.join(snippetsDir, 'foo.md');
      await writeFile(file, content);

      expect(await checkSnippetCsfOrder(docsDir)).toEqual([]);
      expect(await fixSnippets(docsDir)).toEqual([]);
      expect(await fs.readFile(file, 'utf8')).toBe(content);
    });
    it('fixes the order, moving attached comments with their block', async () => {
      const file = path.join(snippetsDir, 'foo.md');
      await writeFile(
        file,
        [
          csf3('react', 'js'),
          csf3('react', 'ts'),
          block('renderer="vue" language="ts"'),
          csf4('react', 'ts'),
          '<!-- comment -->\n\n' + csf4('react', 'js'),
          '',
        ].join('\n\n')
      );

      const changed = await fixSnippets(docsDir);

      expect(changed).toEqual([file]);
      expect(await fs.readFile(file, 'utf8')).toBe(
        [
          '<!-- comment -->\n\n' + csf4('react', 'js'),
          csf4('react', 'ts'),
          block('renderer="vue" language="ts"'),
          csf3('react', 'ts'),
          csf3('react', 'js'),
          '',
        ].join('\n\n')
      );
      expect(await checkSnippetCsfOrder(docsDir)).toEqual([]);
      expect(await fixSnippets(docsDir)).toEqual([]);
    });
  });

  describe('checkSnippetLegacyCsfTitle', () => {
    it('passes for current CSF tab titles', async () => {
      await writeFile(
        path.join(snippetsDir, 'foo.md'),
        '```ts renderer="react" language="ts" tabTitle="Head (CSF 4)"\ncode\n```\n\n' +
          '```svelte renderer="svelte" language="ts" tabTitle="CSF 3"\ncode\n```'
      );
      const errors = await checkSnippetLegacyCsfTitle(docsDir);
      expect(errors).toEqual([]);
    });
    it('errors for CSF Next tab titles', async () => {
      await writeFile(
        path.join(snippetsDir, 'foo.md'),
        '```ts renderer="react" language="ts" tabTitle="Head (CSF Next 🧪)"\ncode\n```'
      );
      const errors = await checkSnippetLegacyCsfTitle(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('Use "Head (CSF 4)" instead');
    });
    it.each([
      ['Svelte CSF', 'CSF 3'],
      ['Svelte CSF 3', 'CSF 3'],
      ['Svelte CSF 4', 'CSF 4'],
    ])('errors for the "%s" tab title', async (tabTitle, renamed) => {
      await writeFile(
        path.join(snippetsDir, 'foo.md'),
        `\`\`\`svelte renderer="svelte" language="ts" tabTitle="${tabTitle}"\ncode\n\`\`\``
      );
      const errors = await checkSnippetLegacyCsfTitle(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain(`Use "${renamed}" instead`);
    });
  });

  describe('checkSnippetCsf3Deprecation', () => {
    const fence = (syntax: string, title: string, body: string) =>
      `\`\`\`${syntax} renderer="react" language="ts" tabTitle="${title}"\n${body}\n\`\`\``;

    it('passes when CSF 3 blocks start with the comment', async () => {
      await writeFile(
        path.join(snippetsDir, 'foo.md'),
        [
          fence('ts', 'CSF 4', 'code'),
          fence('ts', 'CSF 3', `${CSF3_DEPRECATION_COMMENT}\ncode`),
        ].join('\n\n')
      );
      const errors = await checkSnippetCsf3Deprecation(docsDir);
      expect(errors).toEqual([]);
    });
    it('errors when a CSF 3 block lacks the comment', async () => {
      await writeFile(path.join(snippetsDir, 'foo.md'), fence('ts', 'Head (CSF 3)', 'code'));
      const errors = await checkSnippetCsf3Deprecation(docsDir);
      expect(errors.length).toBe(1);
      expect(errors[0].line).toBe(1);
      expect(errors[0].message).toContain(CSF3_DEPRECATION_COMMENT);
    });
    it('adds the comment in the syntax of each block', async () => {
      const file = path.join(snippetsDir, 'foo.md');
      await writeFile(
        file,
        [
          fence('ts', 'CSF 4', 'code'),
          fence('ts', 'CSF 3', 'code'),
          fence('svelte', 'CSF 3', '<script module></script>'),
          fence('mdx', 'CSF 3', 'import x from "y";'),
          '',
        ].join('\n\n')
      );

      await fixSnippets(docsDir);

      const message =
        '⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4';
      expect(await fs.readFile(file, 'utf8')).toBe(
        [
          fence('ts', 'CSF 4', 'code'),
          fence('ts', 'CSF 3', `// ${message}\ncode`),
          fence('svelte', 'CSF 3', `<!-- ${message} -->\n<script module></script>`),
          fence('mdx', 'CSF 3', `{/* ${message} */}\nimport x from "y";`),
          '',
        ].join('\n\n')
      );
      expect(await checkSnippetCsf3Deprecation(docsDir)).toEqual([]);
      expect(await fixSnippets(docsDir)).toEqual([]);
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
