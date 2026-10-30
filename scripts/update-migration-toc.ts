import { readFile, writeFile } from 'node:fs/promises';
import { argv, cwd, exit } from 'node:process';
import { fileURLToPath } from 'node:url';

import { dirname, resolve } from 'pathe';

/**
 * Rebuild the table of contents at the top of MIGRATION.md so it matches the
 * current `##`–`######` headings in the file. Mirrors the output of the vscode
 * Markdown All-in-One extension that contributors rely on when saving the file
 * in their editor, so that running this in lint-staged produces the same TOC.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const positional = argv.slice(2).filter((a) => !a.startsWith('--'));
const file = positional[0] ? resolve(cwd(), positional[0]) : resolve(repoRoot, 'MIGRATION.md');
const check = argv.includes('--check');

const src = await readFile(file, 'utf8');
const lines = src.split('\n');

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w一-龥\s-]/g, '')
    .replace(/\s/g, '-');
}

function tocText(heading: string): string {
  let out = '';
  let inCode = false;
  for (const c of heading) {
    if (c === '`') {
      inCode = !inCode;
      out += c;
      continue;
    }
    out += !inCode && (c === '<' || c === '_') ? '\\' + c : c;
  }
  return out;
}

let firstH2 = -1;
let inCode = false;
for (let i = 0; i < lines.length; i++) {
  if (/^```/.test(lines[i])) inCode = !inCode;
  if (!inCode && /^## /.test(lines[i])) {
    firstH2 = i;
    break;
  }
}
if (firstH2 < 0) {
  console.error(`${file}: no H2 found; cannot locate TOC range.`);
  exit(1);
}

let tocStart = -1;
for (let i = 0; i < firstH2; i++) {
  if (/^- \[/.test(lines[i])) {
    tocStart = i;
    break;
  }
}
if (tocStart < 0) {
  console.error(`${file}: no TOC bullet list found above the first H2.`);
  exit(1);
}

let tocEnd = tocStart;
for (let i = tocStart; i < firstH2; i++) {
  if (/^(?:- \[|\s+- \[)/.test(lines[i])) tocEnd = i;
}

const headings: { level: number; text: string }[] = [];
inCode = false;
for (let i = firstH2; i < lines.length; i++) {
  const l = lines[i];
  if (/^```/.test(l)) {
    inCode = !inCode;
    continue;
  }
  if (inCode) continue;
  const m = l.match(/^(#{2,6}) (.+?)\s*$/);
  if (m) headings.push({ level: m[1].length, text: m[2].replace(/\s+#*\s*$/, '') });
}

const used = new Set<string>();
const nextSuffix = new Map<string, number>();
const tocLines = headings.map(({ level, text }) => {
  const base = slugify(text);
  let slug = base;
  while (used.has(slug)) {
    const n = nextSuffix.get(base) ?? 1;
    nextSuffix.set(base, n + 1);
    slug = `${base}-${n}`;
  }
  used.add(slug);
  return `${'  '.repeat(level - 2)}- [${tocText(text)}](#${slug})`;
});

const currentToc = lines.slice(tocStart, tocEnd + 1).join('\n');
const newToc = tocLines.join('\n');

if (currentToc === newToc) {
  console.log(`${file}: TOC up to date.`);
  exit(0);
}

if (check) {
  console.error(
    `${file}: TOC is out of date. Run \`yarn --cwd scripts update-migration-toc\` to fix.`
  );
  exit(1);
}

await writeFile(
  file,
  [...lines.slice(0, tocStart), ...tocLines, ...lines.slice(tocEnd + 1)].join('\n')
);
console.log(`${file}: TOC updated.`);
