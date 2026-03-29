---
name: review-pr
description: "Generate a Reveal.js slideshow to review a PR. Use when the user says 'review pr', 'review this PR', 'slideshow review', 'pr slideshow', or wants to review PR changes in a narrative presentation format."
allowed-tools: Bash, Read, Write, Edit, Agent, Grep, Glob
---

# PR Review Slideshow

Generate a Reveal.js slideshow that walks through a PR as a narrative — starting from the main flow, then zooming into every detail.

## Philosophy

Two principles — both matter, they work on different axes:

1. **Big picture first.** The horizontal flow goes broad → specific. Start with the high-level "what and why", then progressively zoom into each area of change.
2. **Tests first.** At each stop along the way, show the test before the implementation. The test explains *what* the behavior is. The implementation explains *how*.

Together: you walk through the PR from the broadest overview to the smallest detail, and at every level you see the test before you see the code.

Other principles:
- **Discuss before you fix, fix before you present.** Flag readability problems, get approval, then clean up.
- **If reading the tests doesn't make the change obvious, that's a smell.** Flag it.
- **Cover everything.** By the last slide, every changed file has been addressed.
- **Less is more.** Omit boilerplate, but always note what you left out.

## Step 1 — Gather PR data

Determine the PR to review. If the user provides a PR number, use that. Otherwise detect from the current branch:

```bash
# Get PR number from current branch
gh pr view --json number,title,author,headRefName,baseRefName,body,additions,deletions,changedFiles

# Get the list of changed files
gh pr diff --name-only

# Get the full diff
gh pr diff
```

If a PR number or URL is given as an argument, pass it to `gh pr view <arg>` and `gh pr diff <arg>`.

## Step 2 — Read and analyze changes

For each changed file:

1. Read the full diff (from `gh pr diff`)
2. Read the full file content for surrounding context (use `Read` tool)
3. Identify if it's a **test file**, **type definition**, **implementation**, **config**, or **docs**

For each implementation file, look for a corresponding test file:
- `foo.ts` → look for `foo.test.ts`, `foo.spec.ts`, `foo.test.tsx`, `__tests__/foo.ts`
- Even if the test file wasn't changed, read it for context if the implementation was changed

## Step 3 — Identify and discuss problems

Before building the slideshow, scan the PR for readability issues. **Don't fix anything yet** — present findings and let the user decide.

```bash
gh pr checkout <number>
```

Look for:
- Vague test names, massive test setup, missing assertions
- Changed code with no test coverage
- Unclear names, dead code, overly clever logic
- `any` types where a proper type is obvious

Present a numbered list with concrete examples and suggested fixes. Then **wait** — the user decides what gets fixed (all, some, or none).

After approval, fix in the working tree, lint, test, commit as a separate commit, and push.

If the user says skip, go straight to Step 4 — unfixed issues will naturally show up in the slideshow as code that's hard to explain.

## Step 4 — Plan the narrative

The slideshow tells a story on two axes.

### Horizontal axis: big picture → specific areas

Group the changes into logical areas and order them broad-to-specific:

1. **Big picture** — what this PR does and why, in plain English
2. **Core areas** — the main logical groups of change, ordered from most important to least. Each area becomes a horizontal slide.
3. **Supporting changes** — config, dependencies, docs that don't fit the core areas
4. **Summary** — key takeaways

### Vertical axis: test first, then implementation

Within each area, the vertical slides follow this order:

1. **Overview** — what changed in this area, in plain English (the top slide)
2. **Test** — the test that explains the behavior. Show it fully. The reader should understand the *what* from this alone.
3. **Implementation** — the code that makes the test pass. Show enough context.
4. **More details** — types, helpers, surrounding context, additional tests

If there's no test for an area, the overview slide flags that with a smell-box, and the implementation goes directly below it.

### Check coverage — MANDATORY

After planning, run through the list of changed files from `gh pr diff --name-only` and verify **every single file** appears somewhere in the slideshow — in an area, in a zoom-in, or in supporting changes.

This is not optional. If a file is missing from the slideshow, the review is incomplete. Use `file-path` spans for every file so coverage can be verified by searching the HTML.

For files with trivial changes (e.g. lockfiles, tsconfig one-liners), a bullet point in the Supporting Changes slide is enough. But they must appear.

## Step 5 — Generate the slideshow

Pick a short unique ID for this slideshow — use the PR number (e.g. `pr-34365`). The output directory is:

```
~/life/slideshows/<id>/
```

Write the slideshow to `~/life/slideshows/<id>/index.html`.

### Narrative structure

```
[Title] → [Big Picture] → [Area 1]    → [Area 2]    → ... → [Supporting] → [Summary]
                               ↓              ↓                    ↓
                          [Test 1a]      [Test 2a]           [Config diffs]
                               ↓              ↓
                          [Impl 1a]      [Impl 2a]
                               ↓
                          [Test 1b]
                               ↓
                          [Impl 1b]
```

**Horizontal (← →)** = big picture → specific areas. Read left-to-right to understand the shape of the PR.
**Vertical (↓)** = test first, then implementation. Press down to see *what* the behavior is (test), then *how* it works (code).

A reader who only goes right sees each area at a glance. A reader who also goes down gets the full test-then-implementation story for each area.

### HTML template

Use this exact template structure. Replace `{{SLIDES}}` with generated slide content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PR Review: {{TITLE}}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/dist/reveal.css">
  <!-- Light syntax theme (default) -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/github.min.css" media="(prefers-color-scheme: light), (prefers-color-scheme: no-preference)">
  <!-- Dark syntax theme -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/github-dark.min.css" media="(prefers-color-scheme: dark)">
  <style>
    /* --- System-aware theme via CSS variables --- */
    :root {
      --bg: #ffffff;
      --fg: #1f2328;
      --muted: #57606a;
      --border: #d0d7de;
      --surface: #f6f8fa;
      --badge-bg: #eef1f5;
      --add-bg: #dafbe1; --add-border: #1a7f37;
      --remove-bg: #ffebe9; --remove-border: #cf222e;
      --note-bg: #ddf4ff; --note-border: #0969da;
      --smell-bg: #fff8c5; --smell-border: #9a6700;
      --green: #1a7f37; --blue: #0969da; --amber: #9a6700; --purple: #8250df;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d1117;
        --fg: #e6edf3;
        --muted: #8b949e;
        --border: #30363d;
        --surface: #161b22;
        --badge-bg: #21262d;
        --add-bg: #1a3a1a; --add-border: #3fb950;
        --remove-bg: #3a1a1a; --remove-border: #f85149;
        --note-bg: #0d1f2d; --note-border: #58a6ff;
        --smell-bg: #2a1f0a; --smell-border: #d29922;
        --green: #3fb950; --blue: #58a6ff; --amber: #d29922; --purple: #bc8cff;
      }
    }

    /* --- Reveal overrides (no theme CSS — we control everything) --- */
    .reveal-viewport { background: var(--bg); }
    .reveal { font-size: 28px; color: var(--fg); font-family: 'Lexend', sans-serif; }
    .reveal h1, .reveal h2, .reveal h3, .reveal h4 { color: var(--fg); font-family: 'Lexend', sans-serif; }
    .reveal h1 { font-size: 1.8em; }
    .reveal h2 { font-size: 1.4em; }
    .reveal h3 { font-size: 1.1em; }
    .reveal pre { width: 100%; font-size: 0.8em; box-shadow: none; }
    .reveal pre code { max-height: 520px; padding: 16px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); font-family: 'JetBrains Mono', monospace; }
    .reveal .slides section { text-align: left; padding: 20px 40px; }
    .reveal a { color: var(--blue); }
    .reveal strong { color: var(--fg); }
    .reveal .progress { color: var(--blue); }
    .reveal .controls { color: var(--muted); }

    .file-path {
      display: inline-block;
      background: var(--badge-bg);
      color: var(--muted);
      padding: 2px 10px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.7em;
      margin-bottom: 12px;
    }
    .diff-add {
      background: var(--add-bg);
      border-left: 3px solid var(--add-border);
      padding: 8px 16px; border-radius: 4px; margin: 8px 0;
      font-family: 'JetBrains Mono', monospace; font-size: 0.7em;
      white-space: pre; overflow-x: auto; color: var(--fg);
    }
    .diff-remove {
      background: var(--remove-bg);
      border-left: 3px solid var(--remove-border);
      padding: 8px 16px; border-radius: 4px; margin: 8px 0;
      font-family: 'JetBrains Mono', monospace; font-size: 0.7em;
      white-space: pre; overflow-x: auto; color: var(--fg);
    }
    .note-box {
      background: var(--note-bg);
      border-left: 3px solid var(--note-border);
      padding: 12px 16px; border-radius: 4px; margin: 12px 0;
      font-size: 0.75em; color: var(--fg);
    }
    .smell-box {
      background: var(--smell-bg);
      border-left: 3px solid var(--smell-border);
      padding: 12px 16px; border-radius: 4px; margin: 12px 0;
      font-size: 0.75em; color: var(--fg);
    }
    .omitted-box {
      background: var(--surface);
      border: 1px dashed var(--border);
      padding: 10px 16px; border-radius: 4px; margin: 12px 0;
      font-size: 0.7em; color: var(--muted);
      text-align: center; font-style: italic;
    }
    .stats {
      display: flex; gap: 24px; margin: 16px 0;
      font-size: 0.75em; color: var(--muted);
    }
    .stats .add { color: var(--green); }
    .stats .remove { color: var(--remove-border); }
    .stats .files { color: var(--blue); }
    .file-list {
      columns: 2; column-gap: 32px;
      font-size: 0.7em; font-family: 'JetBrains Mono', monospace;
      color: var(--muted); list-style: none; padding: 0;
    }
    .file-list li { padding: 3px 0; break-inside: avoid; }
    .file-list .test { color: var(--green); }
    .file-list .impl { color: var(--blue); }
    .file-list .config { color: var(--amber); }
    .file-list .types { color: var(--purple); }
    .section-title { text-align: center !important; }
    .section-title h2 { font-size: 1.6em; }
    .section-title p { color: var(--muted); font-size: 0.8em; }
    .down-hint { color: var(--muted); font-size: 0.65em; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
      {{SLIDES}}
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/dist/reveal.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/plugin/highlight/highlight.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/plugin/markdown/markdown.js"></script>
  <script>
    Reveal.initialize({
      hash: true,
      slideNumber: 'c/t',
      transition: 'slide',
      transitionSpeed: 'fast',
      width: 1280,
      height: 720,
      margin: 0.04,
      plugins: [RevealHighlight, RevealMarkdown],
      highlight: { highlightOnLoad: true }
    });
  </script>
</body>
</html>
```

### Slide guidelines

**Title slide:**
```html
<section class="section-title">
  <h1>PR #{{NUMBER}}: {{TITLE}}</h1>
  <p>by {{AUTHOR}} · {{BRANCH}} → {{BASE}}</p>
  <div class="stats">
    <span class="files">{{FILES}} files</span>
    <span class="add">+{{ADDITIONS}}</span>
    <span class="remove">-{{DELETIONS}}</span>
  </div>
</section>
```

**Big picture slide — sets up the story, previews the areas:**
```html
<section>
  <h2>What this PR does</h2>
  <p>{{2-3 sentence summary of the change and why it matters}}</p>
  <h3>Areas of change</h3>
  <ol>
    <li><strong>{{Area 1}}</strong> — {{one-liner}}</li>
    <li><strong>{{Area 2}}</strong> — {{one-liner}}</li>
    <li><strong>{{Area 3}}</strong> — {{one-liner}}</li>
  </ol>
  <p class="down-hint">→ to walk through each area</p>
</section>
```

**Area slide — overview on top, test below, implementation below that:**
```html
<section>
  <!-- Top: area overview (the horizontal slide a reader sees going left-to-right) -->
  <section>
    <h2>{{Area name}}</h2>
    <p>{{What changed in this area and why, in plain English}}</p>
    <span class="file-path">path/to/main-file.ts</span>
    <pre><code data-trim data-line-numbers="{{changed lines}}" class="language-typescript">
// Show just the key change — the "headline" that orients the reader
    </code></pre>
    <div class="note-box">{{How this area connects to the rest of the PR}}</div>
    <p class="down-hint">↓ tests, then implementation</p>
  </section>

  <!-- Zoom 1: the TEST — shows what the behavior should be -->
  <section>
    <h3>What the tests say</h3>
    <span class="file-path">path/to/file.test.ts</span>
    <pre><code data-trim data-line-numbers class="language-typescript">
// Show the full test — the reader should now understand the expected behavior
    </code></pre>
    <div class="note-box">{{Plain-English summary of what this test tells us}}</div>
  </section>

  <!-- Zoom 2: the implementation that makes the test pass -->
  <section>
    <h3>Implementation</h3>
    <span class="file-path">path/to/file.ts</span>
    <pre><code data-trim data-line-numbers="{{changed lines}}" class="language-typescript">
// Show the implementation with enough surrounding context
    </code></pre>
    <div class="note-box">{{Why this approach was taken}}</div>
  </section>

  <!-- Zoom 3+: more context, types, additional tests, helpers... -->
</section>
```

**Area with no test (flag the smell, show implementation directly):**
```html
<section>
  <section>
    <h2>{{Area name}}</h2>
    <p>{{What changed and why}}</p>
    <span class="file-path">path/to/file.ts</span>
    <pre><code data-trim data-line-numbers="{{changed lines}}" class="language-typescript">
// Show the changed code
    </code></pre>
    <div class="smell-box">🔍 No test covers this change — the behavior has to be inferred from the implementation.</div>
    <p class="down-hint">↓ details</p>
  </section>
  <!-- Zoom slides for implementation context... -->
</section>
```

**Supporting changes slide — for files that don't fit the main flow:**
```html
<section>
  <section>
    <h2>Supporting changes</h2>
    <p>These files support the main flow but aren't part of it:</p>
    <ul>
      <li><span class="file-path">package.json</span> — added dependency X</li>
      <li><span class="file-path">tsconfig.json</span> — enabled option Y</li>
    </ul>
    <p class="down-hint">↓ details</p>
  </section>
  <!-- vertical slides with the actual diffs -->
</section>
```

**When omitting code:**
```html
<div class="omitted-box">⏭ 47 lines of error handling omitted — standard try/catch pattern</div>
```

**When a test exists but doesn't fully explain the code:**
```html
<div class="smell-box">🔍 The test only covers the happy path — the implementation handles 3 edge cases that aren't tested.</div>
```

**Diff highlights for before → after:**
```html
<div class="diff-remove">- const oldWay = doThing(a, b);</div>
<div class="diff-add">+ const newWay = doThingBetter(a, b, options);</div>
```

**Summary slide:**
```html
<section class="section-title">
  <h2>Summary</h2>
  <ul style="text-align: left; display: inline-block;">
    <li>{{Key takeaway 1}}</li>
    <li>{{Key takeaway 2}}</li>
  </ul>
  <div class="note-box">{{Open questions or concerns, if any}}</div>
</section>
```

### Code display rules

1. **Horizontal top slides = area overview** — the headline change, just enough to follow the big picture going left-to-right
2. **First zoom = test** — show complete test bodies, the reader now understands the behavior
3. **Second zoom = implementation** — the code that makes the test pass, with surrounding context
3. **Use `data-line-numbers="X-Y"` to highlight changed lines** within a larger code block
4. **One concept per slide** — split large changes across multiple vertical slides
5. **Max ~30 lines of code per slide** — if more, split or omit with an omitted-box
6. **HTML-escape all code content** — replace `<` with `&lt;`, `>` with `&gt;`, `&` with `&amp;` in all code blocks and diff divs
7. **Every changed file must appear somewhere** — this is the most important rule. Run `gh pr diff --name-only` and check every file off against the slideshow. Missing files = incomplete review. Use `<span class="file-path">` for each file so coverage is verifiable

## Step 6 — Write the server and start it

Write this live-reload server to `~/life/slideshows/<id>/server.mjs`:

```javascript
import { createServer } from 'node:http';
import { readFileSync, watch } from 'node:fs';
import { join, extname } from 'node:path';

const dir = new URL('.', import.meta.url).pathname;
const port = 3000;
let clients = [];

watch(dir, { recursive: true }, (event, filename) => {
  if (filename === 'server.mjs') return;
  clients.forEach(res => {
    try { res.write('data: reload\n\n'); } catch {}
  });
});

createServer((req, res) => {
  if (req.url === '/__sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('data: connected\n\n');
    clients.push(res);
    req.on('close', () => { clients = clients.filter(c => c !== res); });
    return;
  }

  try {
    const filePath = join(dir, req.url === '/' ? 'index.html' : req.url);
    let content = readFileSync(filePath);
    const ext = extname(filePath);
    const types = {
      '.html': 'text/html', '.js': 'text/javascript',
      '.css': 'text/css', '.json': 'application/json',
      '.mjs': 'text/javascript',
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });

    if (ext === '.html') {
      content = content.toString().replace('</body>',
        `<script>
          const es = new EventSource('/__sse');
          es.onmessage = (e) => { if (e.data === 'reload') location.reload(); };
          es.onerror = () => setTimeout(() => location.reload(), 1000);
        </script>\n</body>`);
    }
    res.end(content);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => {
  console.log(`\n  PR Review: http://localhost:${port}\n`);
  console.log('  Watching for changes...\n');
});
```

Then start it:

```bash
mkdir -p ~/life/slideshows/<id>
# Write server.mjs and index.html first, then:
node ~/life/slideshows/<id>/server.mjs &
open http://localhost:3000  # macOS
```

Run the server in the background using Bash with `run_in_background: true`.

## Step 7 — Iterate

After generating the initial slideshow, tell the user:
- The slideshow is live at http://localhost:3000
- They can ask you to update specific slides
- The browser will auto-reload when you write changes

When the user asks for updates, just rewrite `~/life/slideshows/<id>/index.html` — the browser will auto-reload.

## Important rules

- **Discuss fixes first.** Scan for readability problems, present them, wait for approval before changing code.
- **Horizontal = big picture.** A reader pressing only → sees each area of change at a glance.
- **Vertical = test first, then implementation.** Press ↓ to see the test (what), then the code (how).
- **Cover everything.** Every changed file appears in the slideshow — in the flow, in a zoom-in, or in supporting changes.
- **Always HTML-escape code.** `<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`.
- **Kill any existing server on port 3000** before starting: `lsof -ti:3000 | xargs kill -9 2>/dev/null || true`
- **Note omissions.** If you skip code, always say what and roughly how much.
- **One concept per slide.** Use vertical slides to go deeper, not wider.
- **Separate fix commit.** Never mix review fixes with the author's commits.
