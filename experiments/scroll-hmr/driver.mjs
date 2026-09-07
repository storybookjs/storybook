import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

const SCRATCH = '/tmp/claude-0/-home-user-storybook/10a8e711-1b08-5701-8d8b-52ba7c733784/scratchpad';
const SANDBOX = '/home/user/storybook-sandboxes/react-vite-default-ts';
const STORY_FILE = path.join(SANDBOX, 'src/stories/ScrollLab.stories.tsx');
const TEMPLATE = fs.readFileSync(path.join(SCRATCH, 'ScrollLab.template.tsx'), 'utf8');
const BASE = process.env.SB_URL || 'http://localhost:6006';
const SCROLL_TO = 1500;
const TRIALS = Number(process.env.TRIALS || 5);
const OUT_DIR = path.join(SCRATCH, 'results');
fs.mkdirSync(OUT_DIR, { recursive: true });

// config name -> __exp flags
const CONFIGS = {
  baseline: '',
  revert: 'forceScrollReset',
  A_noSpinner: 'noSpinner',
  B1_keepDom: 'keepDom',
  B2_keepDomRoot: 'keepDom,keepRoot',
  AB_all: 'noSpinner,keepDom,keepRoot',
};
const STORIES = { fast: 'scrolllab--fast', slow: 'scrolllab--slow' };

// e.g. ONLY=baseline:fast,B2_keepDomRoot (story part optional, comma-separated pairs)
const only = process.env.ONLY ? process.env.ONLY.split(',').map((s) => s.split(':')) : null;

let tokenCounter = 0;
function writeStory(token) {
  fs.writeFileSync(STORY_FILE, TEMPLATE.replace(/%TOKEN%/g, token));
}
function newToken() {
  tokenCounter += 1;
  return `TK${Date.now().toString(36)}X${tokenCounter}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runTrial(page, trialId) {
  const token = newToken();

  // 1. scroll to target and let everything settle
  await page.evaluate((y) => window.scrollTo(0, y), SCROLL_TO);
  await sleep(400);
  const startY = await page.evaluate(() => window.scrollY);

  // 2. mark + clear trace + set reload sentinel
  await page.evaluate((tid) => {
    window.__trialSentinel = tid;
    window.__sbTrace.length = 0;
    window.__probeLog('editMark', tid);
  }, trialId);

  // 3. touch the story file -> vite HMR
  writeStory(token);

  // 4. wait for the new token to be committed to the DOM (textContent ignores display:none)
  let tokenApplied = true;
  try {
    await page.waitForFunction((tok) => document.body.textContent.includes(tok), token, {
      timeout: 15000,
    });
  } catch {
    tokenApplied = false;
  }

  // 5. sample scroll over the settle window to catch late clamps
  const ySeries = [];
  for (const wait of [0, 250, 500, 1000]) {
    if (wait) {
      await sleep(wait);
    }
    ySeries.push(await page.evaluate(() => window.scrollY));
  }

  const { reloaded, trace, finalY, docH } = await page.evaluate((tid) => {
    return {
      reloaded: window.__trialSentinel !== tid,
      trace: window.__sbTrace.slice(0, 400),
      finalY: window.scrollY,
      docH: document.scrollingElement.scrollHeight,
    };
  }, trialId);

  return { token, startY, tokenApplied, ySeries, finalY, docH, reloaded, trace };
}

async function main() {
  writeStory(newToken());
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const summary = [];

  for (const [config, flags] of Object.entries(CONFIGS)) {
    for (const [storyName, storyId] of Object.entries(STORIES)) {
      if (only && !only.some(([c, st]) => c === config && (!st || st === storyName))) {
        continue;
      }
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      const url = `${BASE}/iframe.html?id=${storyId}&viewMode=story&__exp=${flags}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForSelector('#row-199', { timeout: 90000 });
      await page.waitForFunction(() => document.body.classList.contains('sb-show-main'), null, {
        timeout: 30000,
      });
      await sleep(500);

      const trials = [];
      for (let i = 0; i < TRIALS; i += 1) {
        const trialId = `${config}-${storyName}-${i}`;
        const r = await runTrial(page, trialId);
        trials.push(r);
        const kept = !r.reloaded && r.finalY >= SCROLL_TO - 5;
        console.log(
          `${trialId}: startY=${r.startY} finalY=${r.finalY} series=[${r.ySeries.join(',')}] ` +
            `kept=${kept} reloaded=${r.reloaded} tokenApplied=${r.tokenApplied}`
        );
        fs.writeFileSync(
          path.join(OUT_DIR, `trace-${trialId}.json`),
          JSON.stringify({ config, storyName, ...r }, null, 1)
        );
      }
      const keptCount = trials.filter((r) => !r.reloaded && r.finalY >= SCROLL_TO - 5).length;
      summary.push({
        config,
        story: storyName,
        kept: keptCount,
        total: trials.length,
        reloads: trials.filter((r) => r.reloaded).length,
        finalYs: trials.map((r) => r.finalY),
      });
      await context.close();
    }
  }

  await browser.close();
  console.log('\n=== SUMMARY ===');
  for (const s of summary) {
    console.log(
      `${s.config.padEnd(16)} ${s.story.padEnd(5)} kept ${s.kept}/${s.total}` +
        ` (reloads: ${s.reloads}) finalY: [${s.finalYs.join(', ')}]`
    );
  }
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
