/**
 * Build a static-HTML mock of the **walk-only** review flow (the team
 * conversation's proposed iteration-1 fork: no before/after, cluster-
 * organised story walk, keyboard-next navigation, agent rationale as
 * section header, latest-only).
 *
 * Reads the medium-scenario depth-aware eval output and renders it as
 * a clickable mock the team can react to in the kickoff. The story
 * previews are placeholder iframes pointing at the running Storybook UI
 * so the latest-only render is real, not faked.
 *
 * Output: scripts/eval/inner-loop/results/walk-only-mock.html
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(HERE, 'results');
const STORYBOOK_URL = process.env.STORYBOOK_URL || 'http://localhost:6006';

interface AgentCluster {
  id: string;
  rationale: string;
  representative: string;
  storyCount: number;
  stories: string[];
}

// Pick the highest-cascade depth-aware run available (medium or large).
async function pickRun(): Promise<{ scenario: string; clusters: AgentCluster[]; cascade: number } | null> {
  for (const candidate of ['exp-I5-medium-depth.jsonl', 'exp-I5-large-depth.jsonl', 'exp-I5-small-depth.jsonl']) {
    const path = join(RESULTS_DIR, candidate);
    try {
      const text = await readFile(path, 'utf8');
      // jsonl can have multiple rows; pick the last successful one.
      const rows = text.trim().split('\n').map((l) => JSON.parse(l));
      const lastGood = [...rows].reverse().find((r) => r.agentRun?.clusters?.length);
      if (lastGood) {
        return {
          scenario: lastGood.scenario,
          clusters: lastGood.agentRun.clusters as AgentCluster[],
          cascade: lastGood.groundTruth?.total ?? 0,
        };
      }
    } catch {
      // not present, try next
    }
  }
  return null;
}

const run = await pickRun();
if (!run) {
  console.error('No depth-aware run found. Run: scripts/eval/inner-loop/run.ts --prompt signature-depth --with-depth');
  process.exit(1);
}

console.log(`Mock from scenario=${run.scenario}, cascade=${run.cascade}, clusters=${run.clusters.length}`);

// Filter empty clusters and sort by cluster size descending.
const clusters = run.clusters.filter((c) => c.storyCount > 0);

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Walk-only review flow — mock (${escapeHtml(run.scenario)})</title>
<style>
  :root {
    --fg: #0f172a;
    --fg-soft: #475569;
    --muted: #94a3b8;
    --bg: #f8fafc;
    --card: #fff;
    --border: #e2e8f0;
    --accent: #2563eb;
    --green: #15803d;
    --green-bg: #dcfce7;
    --slate-bg: #f1f5f9;
    --mono: ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; }
  body {
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: var(--fg);
    background: var(--bg);
    display: grid;
    grid-template-columns: 280px 1fr;
    grid-template-rows: 56px 1fr 56px;
    grid-template-areas:
      "topbar topbar"
      "sidebar main"
      "footer footer";
    height: 100vh;
    overflow: hidden;
  }
  .topbar {
    grid-area: topbar;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    color: #fff;
    padding: 0 24px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .topbar h1 {
    font-size: 15px;
    margin: 0;
    font-weight: 600;
  }
  .topbar .meta {
    font-size: 12px;
    color: #cbd5e1;
    margin-left: auto;
  }
  .topbar .badge {
    background: rgba(255,255,255,0.1);
    color: #fff;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
  }
  .sidebar {
    grid-area: sidebar;
    background: var(--card);
    border-right: 1px solid var(--border);
    overflow-y: auto;
    padding: 16px 0;
  }
  .section-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    padding: 8px 20px 4px;
    font-weight: 700;
  }
  .cluster {
    padding: 10px 20px;
    border-left: 3px solid transparent;
    cursor: pointer;
    transition: background 0.15s;
  }
  .cluster:hover { background: var(--slate-bg); }
  .cluster.active {
    background: var(--slate-bg);
    border-left-color: var(--accent);
  }
  .cluster .cluster-id {
    font-weight: 600;
    font-size: 13px;
  }
  .cluster .cluster-rationale {
    font-size: 11.5px;
    color: var(--fg-soft);
    margin-top: 3px;
    line-height: 1.4;
  }
  .cluster .cluster-meta {
    font-size: 11px;
    color: var(--muted);
    margin-top: 4px;
    display: flex;
    gap: 8px;
  }
  .cluster .cluster-meta .badge {
    background: var(--slate-bg);
    color: var(--fg-soft);
    padding: 1px 6px;
    border-radius: 999px;
    font-weight: 500;
  }
  .cluster .cluster-meta .badge.depth-1 { background: #fee2e2; color: #b91c1c; }
  .cluster .cluster-meta .badge.depth-2 { background: #fef3c7; color: #b45309; }
  .cluster .cluster-meta .badge.depth-3 { background: #dbeafe; color: #1d4ed8; }
  .cluster .cluster-meta .badge.depth-deeper { background: #f1f5f9; color: #64748b; }
  .main {
    grid-area: main;
    display: grid;
    grid-template-rows: auto 1fr;
    overflow: hidden;
  }
  .cluster-header {
    padding: 24px 32px 12px;
    background: var(--card);
    border-bottom: 1px solid var(--border);
  }
  .cluster-header h2 {
    margin: 0 0 6px;
    font-size: 20px;
  }
  .cluster-header .rationale {
    color: var(--fg-soft);
    font-size: 13px;
    max-width: 720px;
  }
  .cluster-header .progress {
    font-size: 12px;
    color: var(--muted);
    margin-top: 10px;
  }
  .preview-area {
    background: var(--bg);
    overflow-y: auto;
    padding: 24px 32px;
  }
  .preview-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 16px;
  }
  .preview-card .preview-title {
    padding: 10px 14px;
    font-family: var(--mono);
    font-size: 12px;
    border-bottom: 1px solid var(--border);
    background: var(--slate-bg);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .preview-card .preview-title .story-id {
    color: var(--fg-soft);
    flex: 1;
  }
  .preview-card .preview-title button {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 11px;
    cursor: pointer;
  }
  .preview-card .preview-title button:hover { background: #fff; }
  .preview-iframe {
    width: 100%;
    height: 260px;
    border: none;
    display: block;
  }
  .footer {
    grid-area: footer;
    background: var(--card);
    border-top: 1px solid var(--border);
    padding: 0 24px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    color: var(--fg-soft);
  }
  .footer .kbd {
    font-family: var(--mono);
    background: var(--slate-bg);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 11px;
    color: var(--fg);
  }
  .footer .spacer { flex: 1; }
  .footer button {
    border: 1px solid var(--border);
    background: var(--card);
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 13px;
    cursor: pointer;
    font-weight: 500;
  }
  .footer button:hover { background: var(--slate-bg); }
  .footer button.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .footer button.primary:hover { background: #1d4ed8; }

  .empty-state {
    padding: 32px;
    text-align: center;
    color: var(--muted);
  }

  /* Disclaimer banner */
  .disclaimer {
    background: #fffbeb;
    border-bottom: 1px solid #fde68a;
    color: #92400e;
    padding: 8px 24px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .disclaimer .strong { font-weight: 600; }
</style>
</head>
<body>

<div class="topbar">
  <h1>Storybook review · agent walk</h1>
  <span class="badge">${run.cascade} stories · ${clusters.length} clusters</span>
  <span class="meta">Mock from scenario "${escapeHtml(run.scenario)}" · cluster output is real eval data · iframes render against live Storybook on ${escapeHtml(STORYBOOK_URL)}</span>
</div>

<div class="sidebar">
  <div class="section-title">Clusters</div>
  ${clusters
    .map((c, i) => {
      const depth =
        (c as any).depthHint !== undefined && (c as any).depthHint !== null
          ? (c as any).depthHint
          : null;
      const depthClass =
        depth === 1 ? 'depth-1' : depth === 2 ? 'depth-2' : depth === 3 ? 'depth-3' : 'depth-deeper';
      const depthLabel = depth !== null ? `depth ${depth}` : 'mixed depth';
      return `<div class="cluster${i === 0 ? ' active' : ''}" data-cluster="${i}" onclick="selectCluster(${i})">
    <div class="cluster-id">${escapeHtml(c.id)}</div>
    <div class="cluster-rationale">${escapeHtml(c.rationale.slice(0, 110))}${c.rationale.length > 110 ? '…' : ''}</div>
    <div class="cluster-meta">
      <span class="badge">${c.storyCount} stories</span>
      <span class="badge ${depthClass}">${depthLabel}</span>
    </div>
  </div>`;
    })
    .join('\n')}
  <div class="section-title" style="margin-top:16px">Zoom out</div>
  <div class="cluster" style="cursor:default;color:var(--muted)">
    <div class="cluster-rationale">Full <code>affected</code> list (${run.cascade} stories) — open as Storybook sidebar</div>
  </div>
</div>

<div class="main">
  <div class="cluster-header" id="cluster-header"></div>
  <div class="preview-area" id="preview-area"></div>
</div>

<div class="footer">
  <span><span class="kbd">↓</span> next story · <span class="kbd">→</span> next cluster · <span class="kbd">M</span> mark reviewed</span>
  <span class="spacer"></span>
  <button>Skip cluster</button>
  <button class="primary">Mark cluster reviewed ✓</button>
</div>

<script>
  const clusters = ${JSON.stringify(
    clusters.map((c) => ({
      id: c.id,
      rationale: c.rationale,
      representative: c.representative,
      storyCount: c.storyCount,
      stories: c.stories,
      depthHint: (c as any).depthHint ?? null,
    }))
  )};
  const STORYBOOK_URL = ${JSON.stringify(STORYBOOK_URL)};
  let active = 0;
  function selectCluster(i) {
    active = i;
    document.querySelectorAll('.cluster[data-cluster]').forEach((el, j) => {
      el.classList.toggle('active', j === i);
    });
    renderCluster();
  }
  function renderCluster() {
    const c = clusters[active];
    const h = document.getElementById('cluster-header');
    h.innerHTML = \`
      <h2>\${c.id}</h2>
      <div class="rationale">\${c.rationale}</div>
      <div class="progress">Showing 1–\${Math.min(c.stories.length, 5)} of \${c.storyCount} · cluster \${active + 1} of \${clusters.length}</div>
    \`;
    const a = document.getElementById('preview-area');
    // Preview the first 5 stories of the cluster (the "lead" view).
    a.innerHTML = c.stories.slice(0, 5).map(sid => \`
      <div class="preview-card">
        <div class="preview-title">
          \${sid === c.representative ? '★ ' : ''}<span class="story-id">\${sid}</span>
          <button>Open in Storybook ↗</button>
          <button>Mark reviewed</button>
        </div>
        <iframe class="preview-iframe" src="\${STORYBOOK_URL}/iframe.html?id=\${encodeURIComponent(sid)}&viewMode=story" loading="lazy"></iframe>
      </div>
    \`).join('') + (c.stories.length > 5 ? \`<div class="empty-state">+ \${c.stories.length - 5} more stories in this cluster — keyboard-next to walk through</div>\` : '');
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') selectCluster((active + 1) % clusters.length);
    if (e.key === 'ArrowLeft') selectCluster((active - 1 + clusters.length) % clusters.length);
  });
  renderCluster();
</script>

</body>
</html>`;

await mkdir(RESULTS_DIR, { recursive: true });
const outPath = join(RESULTS_DIR, 'walk-only-mock.html');
await writeFile(outPath, html);
console.log(`Wrote: ${outPath}`);
console.log(`Open with: open ${outPath}`);
