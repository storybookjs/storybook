// Status flood: the server writes `--statuses` statuses every `--flood-interval` ms, for
// `--flood-ticks` ticks, through the project's own `experimental_getStatusStore('bench/flood')`.
// Values cycle success → warning → error. Tick k writes stories [k*N, (k+1)*N) of the pool, so the
// store grows by N statuses per tick until the pool is covered. `--flood-pool all` (default) uses
// every story, spread in index order; a number uses that many stories spread evenly.
// No Vitest runs, so the manager's cost is measured on its own.
import { changeScanPhase, idlePhase, indexJsonPhase, measureInPage, openPhase } from './common.mjs';

async function flood(ctx, storyIds) {
  const { opts, control, sleep } = ctx;
  const params = new URLSearchParams({
    n: opts.statuses,
    interval: opts['flood-interval'],
    ticks: opts['flood-ticks'],
  });
  const res = await fetch(`http://127.0.0.1:${Number(opts.port) + 1000}/flood/start?${params}`, {
    method: 'POST',
    body: JSON.stringify(storyIds),
  });
  const started = await res.json();
  if (started.error) {
    throw new Error(`flood failed to start: ${started.error}`);
  }
  for (;;) {
    const status = await control('/flood/status');
    if (status.error) {
      throw new Error(`flood failed: ${status.error}`);
    }
    if (!status.running) {
      return { ...started, ticksDone: status.ticks };
    }
    await sleep(250);
  }
}

export default {
  async session(ctx) {
    const { opts, project, phase, tabs } = ctx;
    const all = project.storyIdsAll;
    const poolSize =
      opts['flood-pool'] === 'all' ? all.length : Math.min(all.length, Number(opts['flood-pool']));
    const step = all.length / poolSize;
    const pool = Array.from({ length: poolSize }, (_, i) => all[Math.floor(i * step)]);

    await openPhase(ctx);
    const page = tabs[0].page;

    // Expand every node in the sidebar, as a user who pressed "expand all" would see it.
    await phase('expandAll', async () => {
      await measureInPage(
        page,
        'expandAll',
        () => window.__STORYBOOK_ADDONS_CHANNEL__.emit('storiesExpandAll'),
        undefined,
        500
      );
      return {
        treeItems: await page.evaluate(
          () => document.querySelectorAll('#storybook-explorer-tree [data-item-id]').length
        ),
      };
    });

    await idlePhase(ctx);
    await indexJsonPhase(ctx);
    await changeScanPhase(ctx);

    // Each flood starts from an empty flood status type; the reset's own traffic is not measured.
    await ctx.control('/flood/reset');
    await phase('flood', () => flood(ctx, pool));

    // Same flood with a search query in the sidebar, so the results list shows instead of the tree.
    const query = opts.query ?? project.searchQuery;
    await page.click('#storybook-explorer-searchfield');
    await page.keyboard.type(query, { delay: 50 });
    await page.evaluate(() => window.__perf.waitSettled(500));
    await ctx.control('/flood/reset');
    await phase('floodSearch', async () => ({ query, ...(await flood(ctx, pool)) }));
    ctx.results.heaps.end = await ctx.heaps();
  },
};
