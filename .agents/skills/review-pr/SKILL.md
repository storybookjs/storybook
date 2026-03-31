---
name: review-pr
description: "Generate a scrollable single-page PR review. Use when the user says 'review pr', 'review this PR', 'pr review', or wants to review PR changes in a narrative format."
allowed-tools: Bash, Read, Write, Edit, Agent, Grep, Glob
---

# PR Review — Scrollable Single-Page

Generate a scrollable single-page HTML document that reviews a PR as a readable narrative.

**Always generate the page immediately.** Never block on cleanup or fix discussions.

## Principles

The purpose of this page is to help the **human reviewer** understand and review a PR quickly. The page is a reading aid — it presents the code clearly so the reviewer can form their own opinion.

### Optimize for the reviewer's time

The reviewer should be able to:
- **Skim** the page and grasp what the PR does in 30 seconds (big picture section).
- **Read** any area and understand what that code does without opening their editor.
- **Zoom in** to full files or diffs when they want to inspect details.

### Two layers per area

Each area has two layers:
- **Layer 1 (always visible):** A curated walkthrough — prose explanation with cherry-picked code snippets. Only the parts that matter for understanding.
- **Layer 2 (collapsed):** Full file contents or diffs in `<details>` blocks. The reviewer expands these to zoom in.

### High-level to low-level

Order areas following the **call graph** from entry points down. The reviewer understands the big picture before details. For example: CLI entry point → orchestration → each pipeline step → helpers → utilities → types.

### Within each area: Explain → Contract → Tests → Implementation

Structure each area's walkthrough in this order:

1. **Explanation** — Plain prose first. What does this module do? Why does it exist? How does it fit into the bigger picture? The reviewer should understand the *purpose* before seeing any code.
2. **Functions & data structures** — Show function signatures and the key types/interfaces they use. This is the contract — what goes in, what comes out. Show full interface bodies inline where they're first relevant. Don't defer to "see types.ts".
3. **Tests** — Cherry-pick the test cases that make the behavior concrete. Tests are executable documentation — they turn abstract descriptions into specific examples.
4. **Implementation** — The interesting parts of *how* it works. Skip boilerplate, show the core logic.

Use narrative `<p>` tags between snippets to guide the reviewer through each transition.

### Flag obvious issues, but don't force opinions

If you notice something clearly wrong (bug, missing error handling, naming mismatch), flag it with a smell-box. If something is notably well done, use a note-box. But don't manufacture opinions — if the code is fine, just present it clearly. The reviewer will decide what matters.

### Cover everything

Every changed file appears somewhere — either in a walkthrough snippet or in a collapsed full-file block.

## Step 1 — Gather PR data

```bash
gh pr view --json number,title,author,headRefName,baseRefName,body,additions,deletions,changedFiles
gh pr diff --name-only
gh pr diff
```

If a PR number or URL is given as an argument, pass it to `gh pr view <arg>` and `gh pr diff <arg>`.

## Step 2 — Read all changed files

Read the full file content of every changed file with the `Read` tool. Also read the full diff. Classify each file as test, implementation, config, or docs.

## Step 3 — Generate the page

For each area, write two layers:

### Layer 1: Readable walkthrough (always visible)

A curated narrative that mixes prose with **short code snippets**. Structure it following the principle order:

1. **Explanation** — plain prose describing what this area does, why it exists, and how it fits.
2. **Functions & data structures** — key function signatures and the types they use. Show the contract.
3. **Tests** — cherry-picked test cases that make the behavior concrete with specific examples.
4. **Implementation** — the core logic. Skip boilerplate, show the interesting parts.

Use narrative `<p>` tags between snippets to guide the reviewer through each transition. Add smell-boxes or note-boxes only when something genuinely stands out.

### Layer 2: Full files (always collapsed)

Below the walkthrough, include every file in the area as a collapsed `<details>` block with the complete file content (or diff for modified files). The reader expands these for reference.

First create the output directory:

```bash
mkdir -p .pr-review/pr-<number>
```

Write to `.pr-review/pr-<number>/index.html` (relative to the repo root).

**Verify every file from `gh pr diff --name-only` appears in the page.**

### HTML structure

```
Sticky topbar (nav links)
Header (title, author, stats)
Big picture section
Area 1
  Readable walkthrough (Explain → Contract → Tests → Implementation)
  Full files (collapsed)
Area 2
  ...
Supporting changes
```

### Complete HTML template

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
    .diff-line-add { display: block; background: var(--add-bg); margin: 0 -10px; padding: 0 10px; }
    .diff-line-del { display: block; background: var(--del-bg); margin: 0 -10px; padding: 0 10px; }
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
  <p class="section-desc">{{What this area does}}</p>

  <!-- Layer 1: readable walkthrough with curated snippets -->
  <!-- Layer 2: full files collapsed -->
</div>
<hr class="area-divider">

</div>

<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/languages/typescript.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/languages/json.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/languages/markdown.min.js"></script>
<script>
hljs.highlightAll();
// Post-process: apply line-level diff backgrounds on top of syntax highlighting
document.querySelectorAll('code[data-diff]').forEach(block => {
  block.innerHTML = block.innerHTML.split('\n').map(line => {
    const stripped = line.replace(/<[^>]*>/g, '');
    if (stripped.startsWith('+')) return '<span class="diff-line-add">' + line + '</span>';
    if (stripped.startsWith('-')) return '<span class="diff-line-del">' + line + '</span>';
    return line;
  }).join('\n');
});
</script>
</body>
</html>
```

### Building blocks

**Layer 1 — Readable walkthrough snippet** (curated excerpt with prose):

Start with explanation, then show the contract (function + types), then tests, then implementation. Show full interface bodies inline — not just names:

```html
<div class="file-card">
  <div class="narrative">
    <p><code>processStory</code> is the core rendering pipeline. It takes a story config, prepares the
    rendering context, mounts the component, and returns a result with status and timing.</p>
    <p>The function signature and the types it uses:</p>
  </div>
  <pre><code class="language-typescript">export async function processStory(config: StoryConfig): Promise&lt;StoryResult&gt;

export interface StoryConfig {
  id: string;
  title: string;
  component: ComponentType;
  args: Record&lt;string, unknown&gt;;
  parameters: Parameters;
}

export interface StoryResult {
  status: 'success' | 'error';
  rendered: boolean;
  duration: number;
  errors: string[];
}</code></pre>
  <div class="narrative">
    <p>The happy-path test shows the expected flow concretely:</p>
  </div>
  <pre><code class="language-typescript">const result = await processStory(baseConfig);
expect(result.status).toBe('success');
expect(result.rendered).toBe(true);</code></pre>
  <div class="narrative">
    <p>The implementation is a sequential pipeline — rendering depends on preparation:</p>
  </div>
  <pre><code class="language-typescript">const context = await prepare(config);
const canvas = await render(context);
return summarize(canvas, config);</code></pre>
</div>
```

**Layer 2 — Full file (collapsed, for new files):**
```html
<div class="file-card">
  <div class="file-card-header">
    <span class="badge badge-impl">impl</span>
    <span class="badge badge-new">new</span>
    path/to/file.ts
  </div>
  <details>
    <summary>Full file ({{N}} lines)</summary>
    <pre><code class="language-typescript">{{FULL FILE CONTENT, HTML-ESCAPED}}</code></pre>
  </details>
</div>
```

**Layer 2 — Full file (collapsed, for modified files with diff):**

Use `language-typescript data-diff` — this gives TypeScript syntax highlighting plus line-level add/remove backgrounds via the post-processing script. Lines starting with `+` get green background, `-` get red.

```html
<div class="file-card">
  <div class="file-card-header">
    <span class="badge badge-modified">modified</span>
    path/to/file.ts
  </div>
  <details>
    <summary>Diff</summary>
    <pre><code class="language-typescript" data-diff>-old line
+new line</code></pre>
  </details>
</div>
```

**Supporting change — no code needed:**
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

**Inline issue:**
```html
<div class="smell-box">No unit tests for this file.</div>
```

**Positive note:**
```html
<div class="note-box">These test names read like a specification — good documentation.</div>
```


### Badge reference

| Badge | Class | Use for |
|-------|-------|---------|
| `test` | `badge-test` | Test files |
| `impl` | `badge-impl` | Implementation files |
| `config` | `badge-config` | Config, docs, prompts, lockfiles |
| `new` | `badge-new` | New files (combine with test/impl/config) |
| `modified` | `badge-modified` | Modified files |

### Syntax highlighting

| Class | Use for |
|-------|---------|
| `language-typescript` | `.ts`, `.tsx`, `.js`, `.jsx` (new files) |
| `language-typescript` + `data-diff` attribute | Modified file diffs — gets TS highlighting plus line-level add/remove backgrounds |
| `language-json` | `.json` files |
| `language-markdown` | `.md` files |

**Important:** Do NOT use `language-diff` — it only does `+`/`-` coloring without syntax highlighting. Instead use `language-typescript` with the `data-diff` attribute for diffs. The post-processing script handles line backgrounds.

### HTML escaping

All code inside `<code>` blocks must be escaped: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`.

## Step 4 — Serve the page

Kill any existing server, write a static server, start it:

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
```

Write to `.pr-review/pr-<number>/server.mjs`:

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

```bash
node .pr-review/pr-<number>/server.mjs &   # run_in_background: true
open http://localhost:3000
```

## Step 5 — Iterate

Tell the user:
- The page is live at http://localhost:3000
- They can ask to update specific sections
- Refresh the browser after updates
