// A full addon-vitest run, started by clicking "Run tests" in the sidebar testing widget. The run
// ends when the button is enabled again. The first run includes starting the Vitest child process;
// `--vitest-runs 2` adds a second run on the warm child.
import { openPhase } from './common.mjs';

async function runAll(ctx, timeoutMs) {
  const page = ctx.tabs[0].page;
  const start = Date.now();
  await page.click('button[aria-label="Run tests"]');
  await page.waitForSelector('[aria-label="Running..."]', { timeout: 60_000 });
  const running = Date.now();
  await page.waitForFunction(
    () => {
      const button = document.querySelector('button[aria-label="Run tests"]');
      return button && !button.disabled;
    },
    null,
    { timeout: timeoutMs, polling: 1000 }
  );
  const end = Date.now();
  const widget = await page.evaluate(
    () =>
      document.querySelector('#storybook-testing-module')?.innerText ??
      document.querySelector('[aria-labelledby="storybook-testing-widget-heading"]')?.innerText ??
      ''
  );
  return { runMs: end - start, clickToRunningMs: running - start, widget: widget.slice(0, 500) };
}

export default {
  async session(ctx) {
    const { opts, phase, log } = ctx;
    const timeoutMs = Number(opts['vitest-timeout-min']) * 60_000;
    await openPhase(ctx);
    await phase('vitestRun', () => runAll(ctx, timeoutMs), { quietMs: 3000 });
    ctx.results.heaps.afterRun = await ctx.heaps();
    log(`run 1: ${(ctx.results.phases.vitestRun.info.runMs / 1000).toFixed(0)} s`);
    if (Number(opts['vitest-runs']) > 1) {
      await phase('vitestRunWarm', () => runAll(ctx, timeoutMs), { quietMs: 3000 });
      ctx.results.heaps.afterWarmRun = await ctx.heaps();
    }
    ctx.results.heaps.end = ctx.results.heaps.afterWarmRun ?? ctx.results.heaps.afterRun;
  },
};
