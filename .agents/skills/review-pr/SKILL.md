---
name: review-pr
description: "Generate a scrollable single-page PR review. Use when the user says 'review pr', 'review this PR', 'pr review', or wants to review PR changes in a narrative format."
allowed-tools: Bash, Read, Write, Edit, Agent, Grep, Glob
---

# PR Review — Scrollable Single-Page

Generate a scrollable single-page HTML document that walks through a PR as a narrative — big picture first, then every file grouped by area, tests before implementation.

**Always generate the page immediately.** Never block on cleanup or fix discussions. Include issues as inline smell-boxes.

## Principles

1. **Big picture first.** Summary of what and why, then logical areas from most to least important.
2. **Tests first.** Within each area, show tests before implementation.
3. **Show whole files.** New files: complete content including imports. Modified files: diff. Use `<details>` for files over 100 lines.
4. **Cover everything.** Every changed file appears somewhere.
5. **Issues inline.** Flag problems as smell-boxes next to the relevant file. Never block page generation.

## Step 1 — Gather PR data

```bash
# Get PR metadata (use gh pr view <number> if a PR number is given)
gh pr view --json number,title,author,headRefName,baseRefName,body,additions,deletions,changedFiles
gh pr diff --name-only
gh pr diff
```

## Step 2 — Read all changed files

For each changed file, read the full file content with the `Read` tool. Also read the full diff from `gh pr diff`. Classify each file as test, implementation, config, or docs.

## Step 3 — Generate the page

Group changes into logical areas. Within each area: tests first, then implementation, then config.

Write to `~/life/slideshows/pr-<number>/index.html`.

**Verify every file from `gh pr diff --name-only` appears in the page** — in an area, in supporting changes, or as a bullet point.

### HTML structure

The page has this structure:

```
Sticky topbar (nav links to each area)
Header (title, author, branch, stats)
Big picture section
Area 1 (test files → impl files → config)
Area 2
...
Supporting changes (config, lockfiles, docs)
```

### Complete HTML template

Copy this template exactly. Replace `{{PLACEHOLDERS}}` with actual content.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PR #{{NUMBER}}: {{TITLE}}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/github.min.css" media="(prefers-color-scheme: light), (prefers-color-scheme: no-preference)">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/github-dark.min.css" media="(prefers-color-scheme: dark)">
  <style>
    :root {
      --bg: #fff; --fg: #1f2328; --muted: #656d76; --border: #d0d7de;
      --surface: #f6f8fa; --card: #fff; --card-border: #d0d7de;
      --add-bg: #dafbe1; --add-fg: #116329; --del-bg: #ffebe9; --del-fg: #82071e;
      --hunk-bg: #ddf4ff; --hunk-fg: #0969da;
      --note-bg: #ddf4ff; --note-border: #0969da;
      --smell-bg: #fff8c5; --smell-border: #9a6700;
      --green: #1a7f37; --blue: #0969da; --amber: #9a6700;
      --toc-hover: #eaeef2; --shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d1117; --fg: #e6edf3; --muted: #8b949e; --border: #30363d;
        --surface: #161b22; --card: #161b22; --card-border: #30363d;
        --add-bg: #1a2e1a; --add-fg: #3fb950; --del-bg: #2e1a1a; --del-fg: #f85149;
        --hunk-bg: #0d1f2d; --hunk-fg: #58a6ff;
        --note-bg: #0d1f2d; --note-border: #58a6ff;
        --smell-bg: #2a1f0a; --smell-border: #d29922;
        --green: #3fb950; --blue: #58a6ff; --amber: #d29922;
        --toc-hover: #21262d; --shadow: 0 1px 3px rgba(0,0,0,0.3);
      }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; scroll-padding-top: 56px; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
    body { background: var(--bg); color: var(--fg); font-family: 'Lexend', sans-serif; font-size: 15px; line-height: 1.6; }
    .page { max-width: 960px; margin: 0 auto; padding: 0 2px 100px; }
    .topbar { position: sticky; top: 0; z-index: 100; background: var(--bg); border-bottom: 1px solid var(--border); padding: 10px 0; }
    .topbar-inner { max-width: 960px; margin: 0 auto; padding: 0 4px; display: flex; align-items: center; gap: 10px; overflow-x: auto; }
    .topbar a { color: var(--muted); text-decoration: none; font-size: 13px; font-weight: 500; white-space: nowrap; padding: 3px 7px; border-radius: 6px; }
    .topbar a:hover { background: var(--toc-hover); color: var(--fg); }
    .topbar .pr-tag { color: var(--fg); font-weight: 600; font-size: 14px; }
    .header { padding: 40px 0 28px; border-bottom: 1px solid var(--border); margin-bottom: 36px; }
    .header h1 { font-size: 26px; font-weight: 700; margin-bottom: 6px; }
    .header .meta { color: var(--muted); font-size: 14px; }
    .header .stats { display: flex; gap: 20px; margin-top: 10px; font-size: 14px; font-weight: 500; }
    .header .stats .add { color: var(--green); }
    .header .stats .del { color: var(--del-fg); }
    .header .stats .files { color: var(--blue); }
    .section { margin-bottom: 44px; }
    .section-head { font-size: 21px; font-weight: 700; margin-bottom: 6px; padding-top: 12px; }
    .section-desc { color: var(--muted); margin-bottom: 20px; font-size: 14px; line-height: 1.6; }
    .section-desc code { font-family: 'JetBrains Mono', monospace; font-size: 12px; background: var(--surface); padding: 2px 5px; border-radius: 3px; }
    .file-card { border: 1px solid var(--card-border); border-radius: 8px; margin-bottom: 18px; overflow: hidden; background: var(--card); box-shadow: var(--shadow); }
    .file-card-header { display: flex; align-items: center; gap: 6px; padding: 7px 10px; background: var(--surface); border-bottom: 1px solid var(--card-border); font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--fg); font-weight: 500; flex-wrap: wrap; }
    .badge { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-test { background: var(--add-bg); color: var(--add-fg); }
    .badge-impl { background: var(--hunk-bg); color: var(--hunk-fg); }
    .badge-config { background: var(--smell-bg); color: var(--amber); }
    .badge-new { background: var(--add-bg); color: var(--add-fg); }
    .badge-modified { background: var(--smell-bg); color: var(--amber); }
    .file-card pre { margin: 0; border-radius: 0; }
    .file-card pre code, .file-card pre code.hljs { display: block; padding: 10px; overflow-x: auto; font-family: 'JetBrains Mono', monospace !important; font-size: 13px !important; line-height: 1.4; background: var(--surface) !important; }
    @media (hover: none), (pointer: coarse) {
      .file-card pre code, .file-card pre code.hljs { font-size: 12px !important; padding: 8px 6px; }
    }
    .narrative { padding: 12px 16px; font-size: 13.5px; line-height: 1.6; }
    .narrative code { font-family: 'JetBrains Mono', monospace; font-size: 12px; background: var(--surface); padding: 1px 5px; border-radius: 3px; }
    .note-box { background: var(--note-bg); border-left: 3px solid var(--note-border); padding: 10px 14px; margin: 0 16px 12px; border-radius: 4px; font-size: 13px; }
    .smell-box { background: var(--smell-bg); border-left: 3px solid var(--smell-border); padding: 10px 14px; margin: 0 16px 12px; border-radius: 4px; font-size: 13px; }
    details > summary { cursor: pointer; padding: 9px 14px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--muted); background: var(--surface); border-top: 1px solid var(--card-border); user-select: none; }
    details > summary:hover { color: var(--fg); }
    details[open] > summary { border-bottom: 1px solid var(--card-border); }
    .area-divider { border: none; border-top: 2px solid var(--border); margin: 48px 0 40px; }
    @media (max-width: 768px), (max-height: 500px) {
      body { font-size: 14px; }
      .page { padding: 0 2px 60px; }
      .topbar-inner { padding: 0 2px; gap: 4px; }
      .topbar a { font-size: 11px; padding: 2px 5px; }
      .header { padding: 20px 0 16px; margin-bottom: 20px; }
      .header h1 { font-size: 18px; }
      .section-head { font-size: 17px; }
      .section-desc { font-size: 13px; }
      .section { margin-bottom: 28px; }
      .area-divider { margin: 32px 0 28px; }
      .narrative { padding: 8px 10px; font-size: 12.5px; }
      .note-box, .smell-box { margin: 0 6px 8px; padding: 8px 10px; font-size: 12px; }
      .file-card-header { padding: 6px 8px; font-size: 10.5px; }
      details > summary { padding: 6px 8px; font-size: 10.5px; }
    }
  </style>
</head>
<body>

<div class="topbar"><div class="topbar-inner">
  <span class="pr-tag">#{{NUMBER}}</span>
  <a href="#big-picture">Overview</a>
  <!-- one <a> per area -->
</div></div>

<div class="page">

<div class="header">
  <h1>{{TITLE}}</h1>
  <div class="meta">by {{AUTHOR}} &middot; {{BRANCH}} &rarr; {{BASE}}</div>
  <div class="stats">
    <span class="files">{{FILES}} files</span>
    <span class="add">+{{ADDITIONS}}</span>
    <span class="del">&minus;{{DELETIONS}}</span>
  </div>
</div>

<!-- Big picture -->
<div class="section" id="big-picture">
  <h2 class="section-head">What this PR does</h2>
  <p class="section-desc">{{SUMMARY}}</p>
</div>
<hr class="area-divider">

<!-- Repeat per area -->
<div class="section" id="area-{{id}}">
  <h2 class="section-head">{{N}}. {{Area Name}}</h2>
  <p class="section-desc">{{What changed in this area}}</p>
  <!-- file cards here -->
</div>
<hr class="area-divider">

<!-- Supporting changes (last area) -->

</div>

<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/languages/typescript.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/languages/json.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/languages/diff.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/languages/markdown.min.js"></script>
<script>hljs.highlightAll();</script>
</body>
</html>
```

### Building blocks

Copy-paste these patterns to build the page content.

**New file — shown directly (use for files under ~100 lines):**
```html
<div class="file-card">
  <div class="file-card-header">
    <span class="badge badge-impl">impl</span>
    <span class="badge badge-new">new</span>
    path/to/file.ts
  </div>
  <div class="narrative"><p>What this file does.</p></div>
  <pre><code class="language-typescript">{{FULL FILE CONTENT}}</code></pre>
</div>
```

**New file — collapsed (use for files over ~100 lines):**
```html
<div class="file-card">
  <div class="file-card-header">
    <span class="badge badge-test">test</span>
    <span class="badge badge-new">new</span>
    path/to/file.test.ts
  </div>
  <div class="narrative"><p>What this test covers.</p></div>
  <details>
    <summary>Full file ({{N}} lines)</summary>
    <pre><code class="language-typescript">{{FULL FILE CONTENT}}</code></pre>
  </details>
</div>
```

**Modified file — diff:**
```html
<div class="file-card">
  <div class="file-card-header">
    <span class="badge badge-modified">modified</span>
    path/to/file.ts
  </div>
  <div class="narrative"><p>What changed.</p></div>
  <pre><code class="language-diff">-old line
+new line</code></pre>
</div>
```

**Supporting change — no code block needed:**
```html
<div class="file-card">
  <div class="file-card-header">
    <span class="badge badge-config">config</span>
    <span class="badge badge-modified">modified</span>
    yarn.lock
  </div>
  <div class="narrative"><p>Lockfile updated for new dependencies.</p></div>
</div>
```

**Inline issue (place after a file card):**
```html
<div class="smell-box">No unit tests for this file.</div>
```

**Context note (place after a file card):**
```html
<div class="note-box">This is the only caller of the renamed function.</div>
```

### Badge reference

| Badge | Class | Use for |
|-------|-------|---------|
| `test` | `badge-test` | Test files |
| `impl` | `badge-impl` | Implementation files |
| `config` | `badge-config` | Config, docs, prompts, lockfiles |
| `new` | `badge-new` | New files (combine with test/impl/config) |
| `modified` | `badge-modified` | Modified files |

### Syntax highlighting languages

| Language | Class | Use for |
|----------|-------|---------|
| TypeScript | `language-typescript` | `.ts`, `.tsx`, `.js`, `.jsx` files |
| Diff | `language-diff` | Modified file diffs (lines start with `+`/`-`) |
| JSON | `language-json` | `.json` files |
| Markdown | `language-markdown` | `.md` files |

### HTML escaping

All code content inside `<code>` blocks must be HTML-escaped:
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`

Tip: use a Node script to read files and generate escaped HTML when there are many new files.

## Step 4 — Serve the page

Kill any existing server on port 3000, write the server, start it:

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
```

Write this static server to `~/life/slideshows/pr-<number>/server.mjs`:

```javascript
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const dir = new URL('.', import.meta.url).pathname;
const port = 3000;

createServer((req, res) => {
  try {
    const filePath = join(dir, req.url === '/' ? 'index.html' : req.url);
    const content = readFileSync(filePath);
    const ext = extname(filePath);
    const types = {
      '.html': 'text/html', '.js': 'text/javascript',
      '.css': 'text/css', '.json': 'application/json',
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => {
  console.log(`\n  PR Review: http://localhost:${port}\n`);
});
```

Then:

```bash
node ~/life/slideshows/pr-<number>/server.mjs &   # run_in_background: true
open http://localhost:3000
```

## Step 5 — Iterate

Tell the user:
- The page is live at http://localhost:3000
- They can ask to update specific sections
- Refresh the browser after updates
