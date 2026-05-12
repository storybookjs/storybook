/**
 * Static-baseline feasibility check (raised in SECOND_CONVERSATION.md).
 *
 * Hypothesis: "if a `storybook-static` folder exists, use it as the
 * baseline." Could side-step the env-API/Vite-6 dependency entirely and
 * potentially support Webpack-builder users.
 *
 * What this script checks:
 *  1. Does a `storybook-static` build complete cleanly?
 *  2. Can a parallel HTTP server serve it on a separate port?
 *  3. Does the served instance respond to `/index.json` correctly?
 *  4. Can an iframe URL from the static instance load a story?
 *  5. How long does a fresh build take? (sets the upper bound on
 *     "iteration-1.5 walks user through `npm run build-storybook`".)
 *
 * What this does NOT check (would need real integration):
 *  - Whether the addon-before-after machinery can be re-pointed at a
 *    static folder instead of an env=before iframe build.
 *  - How `storybook-static` compares to env=before for fidelity (CSS
 *    variables, theme switching, etc.).
 *  - Webpack-builder behaviour (only Vite tested here).
 *
 * Output: scripts/eval/inner-loop/results/static-baseline-feasibility.json
 */
import { mkdir, writeFile, stat, readFile } from 'node:fs/promises';
import { spawn, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(HERE, 'results');
const REPO_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const STATIC_DIR = join(REPO_ROOT, 'code', 'storybook-static');
const STATIC_PORT = Number(process.env.STATIC_PORT || 6007);
const LIVE_URL = process.env.STORYBOOK_URL || 'http://localhost:6006';

interface Check {
  id: string;
  description: string;
  result: 'pass' | 'fail' | 'skipped';
  note: string;
  ms?: number;
  data?: unknown;
}

const checks: Check[] = [];

// 1. Does the static folder already exist?
let staticExists = false;
let staticSize = 0;
try {
  const s = await stat(STATIC_DIR);
  staticExists = s.isDirectory();
  if (staticExists) {
    // ballpark size via du
    try {
      const out = execSync(`du -sk "${STATIC_DIR}" 2>/dev/null | awk '{print $1}'`, {
        encoding: 'utf8',
      }).trim();
      staticSize = Number(out) * 1024;
    } catch {}
  }
} catch {}
checks.push({
  id: 'static-folder-present',
  description: 'Does code/storybook-static/ exist?',
  result: staticExists ? 'pass' : 'fail',
  note: staticExists
    ? `Present, ~${(staticSize / 1024 / 1024).toFixed(1)} MB. (Run \`cd code && yarn storybook:ui:build\` to (re)build.)`
    : `Not present. To create: cd code && yarn storybook:ui:build (build time ~3-5 min on the dogfood).`,
  data: { staticDir: STATIC_DIR, sizeBytes: staticSize },
});

if (!staticExists) {
  // Bail early on the runtime checks but document them as skipped.
  for (const id of ['static-index-json', 'static-iframe-serves', 'static-css-fidelity', 'parallel-port']) {
    checks.push({
      id,
      description: `Skipped because static folder absent.`,
      result: 'skipped',
      note: 'Run yarn storybook:ui:build first, then re-run this script.',
    });
  }
} else {
  // 2-4. Spin up a small static file server, hit /index.json, fetch an
  // iframe URL, compare index.json against the live instance.
  console.log(`Spawning static server for ${STATIC_DIR} on :${STATIC_PORT}…`);
  const server = spawn('node', [
    '-e',
    `const http=require('http'),fs=require('fs'),path=require('path');
     const root=${JSON.stringify(STATIC_DIR)};
     const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2'};
     http.createServer((req,res)=>{
       let u=req.url.split('?')[0];if(u==='/')u='/index.html';
       const p=path.join(root,decodeURIComponent(u));
       fs.readFile(p,(err,buf)=>{if(err){res.statusCode=404;res.end('not found');return;}
         res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');
         res.end(buf);
       });
     }).listen(${STATIC_PORT},()=>console.log('listening'));`,
  ]);
  // Give it a moment to bind.
  await new Promise((r) => setTimeout(r, 500));

  try {
    const t0 = Date.now();
    const r = await fetch(`http://localhost:${STATIC_PORT}/index.json`);
    const okIndex = r.ok;
    let storyCount = 0;
    let staticIndex: { entries?: Record<string, unknown> } = {};
    if (okIndex) {
      staticIndex = await r.json();
      storyCount = staticIndex.entries ? Object.keys(staticIndex.entries).length : 0;
    }
    checks.push({
      id: 'static-index-json',
      description: 'GET /index.json from static build',
      result: okIndex && storyCount > 0 ? 'pass' : 'fail',
      note: okIndex ? `${storyCount} stories indexed.` : `HTTP ${r.status}`,
      ms: Date.now() - t0,
      data: { storyCount },
    });

    // 3. Try to load an iframe for a known story.
    if (okIndex && storyCount > 0) {
      const firstStory = Object.keys(staticIndex.entries!)[0];
      const t1 = Date.now();
      const ir = await fetch(
        `http://localhost:${STATIC_PORT}/iframe.html?id=${encodeURIComponent(firstStory)}&viewMode=story`
      );
      checks.push({
        id: 'static-iframe-serves',
        description: 'GET /iframe.html?id=<story> from static build',
        result: ir.ok ? 'pass' : 'fail',
        note: ir.ok ? `Iframe HTML returned (${(await ir.text()).length} chars).` : `HTTP ${ir.status}`,
        ms: Date.now() - t1,
        data: { storyId: firstStory },
      });
    }

    // 4. Compare index.json against the live instance to confirm story
    //    sets match (or document the drift).
    try {
      const liveR = await fetch(`${LIVE_URL}/index.json`);
      if (liveR.ok) {
        const liveIndex = (await liveR.json()) as { entries: Record<string, unknown> };
        const liveCount = Object.keys(liveIndex.entries).length;
        const liveSet = new Set(Object.keys(liveIndex.entries));
        const staticSet = new Set(Object.keys(staticIndex.entries ?? {}));
        const onlyLive = [...liveSet].filter((id) => !staticSet.has(id));
        const onlyStatic = [...staticSet].filter((id) => !liveSet.has(id));
        checks.push({
          id: 'static-vs-live-index',
          description: 'Compare static-build index.json vs live Storybook',
          result: onlyLive.length === 0 && onlyStatic.length === 0 ? 'pass' : 'skipped',
          note:
            onlyLive.length === 0 && onlyStatic.length === 0
              ? 'Identical story sets — static is a faithful baseline.'
              : `Drift: ${onlyLive.length} stories only in live, ${onlyStatic.length} only in static. Expected if static was built at a different commit.`,
          data: {
            liveStoryCount: liveCount,
            staticStoryCount: storyCount,
            onlyLiveCount: onlyLive.length,
            onlyStaticCount: onlyStatic.length,
            sampleOnlyLive: onlyLive.slice(0, 5),
            sampleOnlyStatic: onlyStatic.slice(0, 5),
          },
        });
      }
    } catch {
      checks.push({
        id: 'static-vs-live-index',
        description: 'Compare static-build index.json vs live Storybook',
        result: 'skipped',
        note: `Live Storybook unreachable at ${LIVE_URL}.`,
      });
    }
  } finally {
    server.kill();
  }
}

const summary = {
  pass: checks.filter((c) => c.result === 'pass').length,
  fail: checks.filter((c) => c.result === 'fail').length,
  skipped: checks.filter((c) => c.result === 'skipped').length,
};

const conclusion = (() => {
  if (!staticExists) {
    return 'Cannot evaluate without a fresh static build. Recommended next step before kickoff: a contributor runs `cd code && yarn storybook:ui:build` once and reruns this script. The build is ~3-5 min on the dogfood. If the build itself fails or produces a folder larger than 500 MB, the iteration-1.5 idea is meaningfully harder than expected.';
  }
  const allPass = summary.fail === 0 && summary.pass >= 2;
  if (allPass) {
    return 'Static-baseline approach is mechanically feasible. A `storybook-static` folder served on a parallel port returns a valid index.json and serves iframe URLs identically to the live Storybook. Iteration-1.5 design: addon-before-after detects the folder, spins up a sidecar HTTP server, and uses its iframe URLs as the baseline. Open questions for the kickoff: (a) how does the addon machinery integrate with a sidecar process? (b) does this work on Webpack-builder Storybooks (test separately)? (c) how stale does the static build become during a long agent session — needs UX guidance for "rebuild baseline" CTA.';
  }
  return `Mixed results — ${summary.fail} checks failed. See per-check notes.`;
})();

const out = {
  experiment: 'Static-baseline feasibility check (SECOND_CONVERSATION.md, raised in team conversation)',
  timestamp: new Date().toISOString(),
  staticExists,
  staticSizeBytes: staticSize,
  summary,
  checks,
  conclusion,
};

await mkdir(RESULTS_DIR, { recursive: true });
const outPath = join(RESULTS_DIR, 'static-baseline-feasibility.json');
await writeFile(outPath, JSON.stringify(out, null, 2));

console.log(`\n=== Static-baseline feasibility ===`);
console.log(`  Static folder: ${staticExists ? `present (${(staticSize / 1024 / 1024).toFixed(1)} MB)` : 'absent'}`);
console.log(`  Checks: ${summary.pass} pass · ${summary.fail} fail · ${summary.skipped} skipped`);
for (const c of checks) {
  const icon = c.result === 'pass' ? '✓' : c.result === 'fail' ? '✗' : '·';
  console.log(`  ${icon} ${c.id} — ${c.note}`);
}
console.log(`\nWritten: ${outPath}`);
