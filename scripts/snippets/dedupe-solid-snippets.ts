/**
 * Remove duplicate renderer="solid" blocks appended when tabTitle "" vs "CSF 3" diverged.
 */
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SNIPPETS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '../../docs/_snippets');

function normalizeTabTitle(tabTitle?: string) {
  if (!tabTitle || tabTitle === 'CSF 3') return 'CSF 3';
  return tabTitle;
}

function extractBlocks(source: string) {
  const re = /```(?<syntax>[a-zA-Z0-9]+)?(?<attrs>[^\n]*)\n(?<content>[\s\S]*?)```/g;
  const blocks: { start: number; end: number; attrs: Record<string, string>; source: string }[] = [];
  let m;
  while ((m = re.exec(source))) {
    const attrs: Record<string, string> = {};
    for (const [, k, v] of m.groups.attrs.matchAll(/([a-zA-Z0-9.-]+)="([^"]+)"/g)) attrs[k] = v;
    if (m.groups.syntax) attrs.highlightSyntax = m.groups.syntax.trim();
    blocks.push({
      start: m.index,
      end: m.index + m[0].length,
      attrs,
      source: m.groups.content.trim(),
    });
  }
  return blocks;
}

function blockKey(attrs: Record<string, string>) {
  return `${attrs.renderer}|${attrs.language}|${normalizeTabTitle(attrs.tabTitle)}|${attrs.filename ?? ''}`;
}

let removed = 0;
const files = await fs.readdir(SNIPPETS_DIRECTORY);

for (const file of files.filter((f) => f.endsWith('.md'))) {
  const path = join(SNIPPETS_DIRECTORY, file);
  const content = await fs.readFile(path, 'utf-8');
  const blocks = extractBlocks(content);
  const seen = new Set<string>();
  const toRemove: { start: number; end: number }[] = [];

  for (const block of blocks) {
    if (block.attrs.renderer !== 'solid') continue;
    const key = blockKey(block.attrs);
    if (seen.has(key)) {
      toRemove.push({ start: block.start, end: block.end });
    } else {
      seen.add(key);
    }
  }

  if (!toRemove.length) continue;

  let next = content;
  for (const range of toRemove.sort((a, b) => b.start - a.start)) {
    next = next.slice(0, range.start).trimEnd() + next.slice(range.end);
    removed++;
  }

  next = next.replace(/\n{3,}/g, '\n\n');
  await fs.writeFile(path, next.trimEnd() + '\n', 'utf-8');
}

console.log(`Removed ${removed} duplicate solid blocks`);
