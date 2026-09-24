// Browse and search: type a query into the sidebar search one key at a time, move the highlight in
// the results and in the tree with ArrowDown, then visit stories spread over the index.
// Every key press is one interaction (keydown → first frame after the last DOM mutation it caused).
import { changeScanPhase, idlePhase, indexJsonPhase, openPhase } from './common.mjs';

const RENDER_EVENTS = [
  'storyRendered',
  'docsRendered',
  'storyErrored',
  'storyMissing',
  'storyThrewException',
  'playFunctionThrewException',
];

// The tree row that arrow keys moved to, so runs can check that both builds moved equally far.
// The react-aria tree moves focus. The older tree keeps focus and marks the row with an emotion
// Global rule `[data-ref-id=…][data-item-id=…]:not([data-selected="true"])`.
function treeCursorId() {
  const focused = document.activeElement?.closest?.('#storybook-explorer-tree [data-item-id]');
  const rules = [...document.styleSheets].flatMap((sheet) => {
    try {
      return [...sheet.cssRules];
    } catch {
      return [];
    }
  });
  const highlightRule = /\[data-item-id="([^"]+)"\]:not\(\[data-selected="true"\]\)/;
  const highlight = rules.map((rule) => highlightRule.exec(rule.selectorText ?? '')).find(Boolean);
  return highlight?.[1] ?? focused?.getAttribute('data-item-id') ?? null;
}

async function pressKeys(page, keys, quietMs) {
  await page.evaluate(() => (window.__perf.trackKeys = true));
  for (const key of keys) {
    await page.keyboard.press(key);
    await page.evaluate((q) => window.__perf.waitSettled(q), quietMs);
  }
  await page.evaluate(() => {
    window.__perf.trackKeys = false;
    window.__perf.endInteraction();
  });
}

export default {
  async session(ctx) {
    const { opts, project, phase, tabs, previewFrame, sleep } = ctx;
    const query = opts.query ?? project.searchQuery;
    const arrows = Number(opts.arrows);

    await openPhase(ctx);
    const page = tabs[0].page;
    await idlePhase(ctx);
    await indexJsonPhase(ctx);
    await changeScanPhase(ctx);

    await phase(
      'searchType',
      async () => {
        await page.click('#storybook-explorer-searchfield', { timeout: 300_000 });
        await page.evaluate(() => window.__perf.waitSettled(300));
        await pressKeys(page, [...query], 300);
        return {
          query,
          results: await page.evaluate(
            () => document.querySelectorAll('#storybook-explorer-menu [data-id]').length
          ),
        };
        // searchArrows moves through these results.
      },
      { setup: true }
    );

    await phase('searchArrows', async () => {
      await pressKeys(page, Array(arrows).fill('ArrowDown'), 150);
      return { moves: arrows };
    });

    await phase('treeArrows', async () => {
      await page.fill('#storybook-explorer-searchfield', '');
      await page.keyboard.press('Escape');
      await page.evaluate(() => window.__perf.waitSettled(300));
      await page.focus(`#storybook-explorer-tree [data-item-id="${project.firstStoryId}"]`);
      await pressKeys(page, Array(arrows).fill('ArrowDown'), 150);
      return { moves: arrows, endItemId: await page.evaluate(treeCursorId) };
    });

    // Select a story from the preview, like a link inside a story does, and time until the preview
    // reports it rendered (as seen by the manager).
    await phase('visit', async () => {
      const samples = [];
      const ids = project.visitIds(Number(opts.visits)).filter((id) => id !== project.firstStoryId);
      for (const storyId of ids) {
        const rendered = page.evaluate(
          ([events]) =>
            new Promise((resolve) => {
              const channel = window.__STORYBOOK_ADDONS_CHANNEL__;
              const handlers = {};
              const done = (event) => {
                for (const name of events) channel.off(name, handlers[name]);
                resolve({ event, at: window.__perf.epoch() });
              };
              for (const name of events) {
                handlers[name] = () => done(name);
                channel.on(name, handlers[name]);
              }
              setTimeout(() => done('timeout'), 60_000);
            }),
          [RENDER_EVENTS]
        );
        await sleep(20);
        const start = await previewFrame(page).evaluate((id) => {
          const t = window.__perf.epoch();
          window.__STORYBOOK_ADDONS_CHANNEL__.emit('selectStory', { storyId: id });
          return t;
        }, storyId);
        const { event, at } = await rendered;
        samples.push({ storyId, event, ms: at - start });
        await page.evaluate(() => window.__perf.waitSettled(300));
      }
      return { samples };
    });
    ctx.results.heaps.end = await ctx.heaps();
  },
};
