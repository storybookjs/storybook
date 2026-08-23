/**
 * One-off codemod: add renderer="solid" blocks derived from react snippets
 * where solid/common coverage is missing (avoids React fallback on storybook.js.org).
 */
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SNIPPETS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '../../docs/_snippets');

type SnippetInfo = {
  path: string;
  source: string;
  attributes: Record<string, string>;
};

function extractSnippets(source: string): SnippetInfo[] {
  const snippetRegex =
    /```(?<highlightSyntax>[a-zA-Z0-9]+)?(?<attributes>[^\n]*)\n(?<content>[\s\S]*?)```/g;
  const snippets: SnippetInfo[] = [];
  let match;

  while ((match = snippetRegex.exec(source)) !== null) {
    const { highlightSyntax, attributes, content } = match.groups || {};
    const snippetAttributes: Record<string, string> = {};
    const attributeRegex = /([a-zA-Z0-9.-]+)="([^"]+)"/g;
    let attrMatch;
    while ((attrMatch = attributeRegex.exec(attributes || '')) !== null) {
      snippetAttributes[attrMatch[1]] = attrMatch[2];
    }
    if (highlightSyntax) {
      snippetAttributes.highlightSyntax = highlightSyntax.trim();
    }
    snippets.push({
      path: snippetAttributes.filename || '',
      source: content.trim(),
      attributes: snippetAttributes,
    });
  }

  return snippets;
}

function formatAttributes(attributes: Record<string, string>): string {
  const formatted = Object.entries(attributes)
    .filter(([key]) => key !== 'highlightSyntax')
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');
  return `${attributes.highlightSyntax || 'js'} ${formatted}`;
}

const SKIP_FILE_PATTERNS = [
  /portable-stor/i,
  /compose-stor/i,
  /nextjs/i,
  /react-native/i,
  /tanstack/i,
  /proptypes/i,
  /PropTypes/i,
  /styled-components/i,
  /graphql/i,
  /relay/i,
  /gatsby/i,
];

const SKIP_CONTENT_PATTERNS = [
  /composeStories/,
  /setProjectAnnotations/,
  /@storybook\/nextjs/,
  /@storybook\/react-native/,
  /PropTypes\./,
  /from 'react-dom'/,
  /from "react-dom"/,
  /useFormStatus/,
  /next\/navigation/,
];

function shouldSkipFile(filePath: string, content: string): boolean {
  const base = filePath.split('/').pop() ?? '';
  if (SKIP_FILE_PATTERNS.some((p) => p.test(base))) return true;
  if (SKIP_CONTENT_PATTERNS.some((p) => p.test(content))) return true;
  return false;
}

function hasCoverage(
  snippets: SnippetInfo[],
  language: string | undefined,
  tabTitle: string | undefined,
  filename: string | undefined,
) {
  return snippets.some((s) => {
    if (s.attributes.language !== language) return false;
    if ((s.attributes.tabTitle ?? '') !== (tabTitle ?? '')) return false;
    if (filename && s.attributes.filename && s.attributes.filename !== filename) return false;
    return s.attributes.renderer === 'solid' || s.attributes.renderer === 'common';
  });
}

function reactToSolidSource(source: string, attrs: Record<string, string>): string {
  let result = source;

  result = result.replace(/^import React from ['"]react['"];\n\n?/gm, '');
  result = result.replace(/^import type \{ FC \} from ['"]react['"];\n\n?/gm, '');
  result = result.replace(/\/\/ Replace your-framework[^\n]*\n/g, '');
  result = result.replace(/\/\* Replace your-framework[^*]*\*\/\n/g, '');

  result = result.replace(/@storybook\/your-framework\/node/g, 'storybook-solidjs-vite');
  result = result.replace(/@storybook\/your-framework/g, 'storybook-solidjs-vite');
  result = result.replace(/@storybook\/react-vite\/node/g, 'storybook-solidjs-vite');
  result = result.replace(/@storybook\/react-vite/g, 'storybook-solidjs-vite');
  result = result.replace(/@storybook\/react-webpack5/g, 'storybook-solidjs-vite');
  result = result.replace(/@storybook\/react\b/g, 'storybook-solidjs-vite');

  result = result.replace(
    /framework:\s*'@storybook\/[^']+'/g,
    "framework: 'storybook-solidjs-vite'",
  );
  result = result.replace(
    /framework:\s*"@storybook\/[^"]+"/g,
    'framework: "storybook-solidjs-vite"',
  );

  if (result.includes('useState')) {
    if (!/from ['"]solid-js['"]/.test(result)) {
      result = `import { createSignal } from 'solid-js';\n\n${result}`;
    }
    result = result.replace(
      /import\s*\{[^}]*\buseState\b[^}]*\}\s*from\s*['"]react['"];\n\n?/g,
      '',
    );
    result = result.replace(
      /import\s*\{[^}]*\buseState\b[^}]*\}\s*from\s*['"]react['"];\n/g,
      '',
    );
    result = result.replace(
      /\[\s*(\w+)\s*,\s*(set\w+)\s*\]\s*=\s*useState\(/g,
      '[$1, $2] = createSignal(',
    );
    result = result.replace(/\bif\s*\(\s*!(\w+)\s*\)/g, 'if (!$1())');
    result = result.replace(/\b(\w+)=\{(\w+)\}/g, (match, prop, ident) => {
      if (['Story', 'story', 'args', 'meta', 'component', 'Button', 'children'].includes(ident)) {
        return match;
      }
      if (ident.startsWith('set')) return match;
      if (prop === 'primary' || prop === 'label' || prop === 'value') return `${prop}={${ident}()}`;
      return match;
    });
  }

  if (attrs.filename?.includes('/main.') && attrs.tabTitle?.includes('CSF Next')) {
    result = result.replace(
      /framework:\s*'storybook-solidjs-vite'/,
      "framework: { name: 'storybook-solidjs-vite' }",
    );
  }

  return result.trim();
}

function formatSnippetBlock(attrs: Record<string, string>, source: string): string {
  const highlightSyntax = attrs.highlightSyntax ?? 'js';
  const rest = { ...attrs, renderer: 'solid' };
  return `\`\`\`${formatAttributes({ highlightSyntax, ...rest })}\n${source}\n\`\`\``;
}

async function processFile(filePath: string, dryRun: boolean) {
  const content = await fs.readFile(filePath, 'utf-8');
  if (shouldSkipFile(filePath, content)) {
    return { filePath, added: 0, skipped: 'react-only' };
  }

  const snippets = extractSnippets(content);
  const reactSnippets = snippets.filter((s) => s.attributes.renderer === 'react');
  if (!reactSnippets.length) {
    return { filePath, added: 0, skipped: 'no-react' };
  }

  const toAdd: string[] = [];
  let needsJsComment = false;

  for (const react of reactSnippets) {
    const { language, tabTitle, filename } = react.attributes;
    if (
      hasCoverage(snippets, language, tabTitle, filename) ||
      hasCoverage(snippets, language, tabTitle, undefined)
    ) {
      continue;
    }

    const solidSource = reactToSolidSource(react.source, react.attributes);
    toAdd.push(formatSnippetBlock(react.attributes, solidSource));

    if (tabTitle?.includes('CSF Next') && language === 'js') {
      needsJsComment = true;
    }
  }

  if (!toAdd.length) {
    return { filePath, added: 0, skipped: 'covered' };
  }

  let append = '';
  if (needsJsComment) {
    append += '\n<!-- JS snippets still needed while providing both CSF 3 & Next -->\n';
  }
  append += toAdd.map((b) => `\n${b}`).join('\n') + '\n';

  if (!dryRun) {
    await fs.writeFile(filePath, content.trimEnd() + append, 'utf-8');
  }

  return { filePath, added: toAdd.length, skipped: null };
}

const dryRun = process.argv.includes('--dry-run');

const files = await fs.readdir(SNIPPETS_DIRECTORY);
let totalAdded = 0;
let filesModified = 0;

for (const file of files.filter((f) => f.endsWith('.md'))) {
  const result = await processFile(join(SNIPPETS_DIRECTORY, file), dryRun);
  if (result.added > 0) {
    filesModified++;
    totalAdded += result.added;
    if (dryRun) {
      console.log(`would add ${result.added} → ${file}`);
    }
  }
}

console.log(
  `${dryRun ? 'Would modify' : 'Modified'} ${filesModified} files, ${totalAdded} solid blocks added`,
);
