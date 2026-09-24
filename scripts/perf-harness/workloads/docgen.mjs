// The SB-2057 OSA sync session: docgen extraction, file saves, commands, and a second tab joining.
// Use with the synthetic `--shape docgen` project (default here) or Chromatic, where the harness
// turns on `features.experimentalDocgenServer` through PERF_HARNESS_DOCGEN_SERVER.
import { createWriteStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const hasDocgen = () => window.__perf?.hasService('core/docgen');

export default {
  env: () => ({ PERF_HARNESS_DOCGEN_SERVER: '1' }),
  async session(ctx) {
    const {
      opts,
      project,
      phase,
      tabs,
      context,
      baseUrl,
      previewFrame,
      inBoth,
      heaps,
      results,
      sleep,
      waitQuiet,
      log,
    } = ctx;
    const EDITS = Number(opts.edits);
    const EDIT_INTERVAL = Number(opts['edit-interval']);
    const SINGLES = Number(opts.singles);
    const DOCS = Number(opts.docs);

    const originals = new Map();
    const edit = async (target, revision) => {
      if (!originals.has(target.file)) {
        originals.set(target.file, await readFile(target.file, 'utf8'));
      }
      const marker = `rev_${revision}`;
      await writeFile(target.file, target.apply(originals.get(target.file), marker));
      return marker;
    };
    ctx.onCleanup(async () => {
      for (const [file, contents] of originals) {
        await writeFile(file, contents);
      }
    });

    let revision = 0;
    const [burstTargets, singleTargets, tabTwoTargets] = project.editTargets([
      EDITS,
      SINGLES,
      Math.min(EDITS, 20),
    ]);

    await phase('open', async () => {
      const { tab, openMs } = await ctx.openTab('tab1');
      await tab.page.waitForFunction(hasDocgen, null, { timeout: 120_000 });
      await previewFrame(tab.page).waitForFunction(hasDocgen, null, { timeout: 120_000 });
      return { openMs };
    });

    await phase('extractAll', async () => {
      const tab = tabs[0];
      const visible = previewFrame(tab.page).evaluate(
        ([id]) => window.__perf.waitForDocgen(id, null, 600_000),
        [project.lastComponentId]
      );
      const call = await tab.page.evaluate(() =>
        window.__perf.callCommand('core/docgen', 'extractAllDocgen', undefined)
      );
      const previewVisibleAt = await visible;
      return {
        call,
        commandMs: call.end - call.start,
        previewVisibleMs: previewVisibleAt === null ? null : previewVisibleAt - call.start,
      };
    });

    await phase(
      'burst',
      async () => {
        const start = Date.now();
        const markers = [];
        for (const target of burstTargets) {
          markers.push([target.componentId, await edit(target, ++revision)]);
          await sleep(EDIT_INTERVAL);
        }
        await waitQuiet(3000);
        const landed = await previewFrame(tabs[0].page).evaluate(
          (pairs) =>
            pairs.filter(([id, marker]) => window.__perf.docgenText(id)?.includes(marker)).length,
          markers
        );
        return { edits: markers.length, landedInPreview: landed, editSpanMs: Date.now() - start };
      },
      {
        after: async () => {
          results.heaps.afterBurst = await heaps();
        },
      }
    );

    await phase('singleSaves', async () => {
      const samples = [];
      for (const target of singleTargets) {
        const marker = `rev_${revision + 1}`;
        const waiting = inBoth(tabs[0], ([id, m]) => window.__perf.waitForDocgen(id, m, 60_000), [
          target.componentId,
          marker,
        ]);
        await sleep(50);
        const saveAt = Date.now();
        await edit(target, ++revision);
        const seen = await waiting;
        samples.push({
          componentId: target.componentId,
          managerMs: seen.manager === null ? null : seen.manager - saveAt,
          previewMs: seen.preview === null ? null : seen.preview - saveAt,
        });
        await waitQuiet(1000);
      }
      return { samples };
    });

    await phase('singleCommands', async () => {
      const samples = [];
      for (const target of singleTargets) {
        const call = await tabs[0].page.evaluate(
          ([id]) => window.__perf.callCommand('core/docgen', 'extractDocgen', { id }),
          [target.componentId]
        );
        samples.push({
          componentId: target.componentId,
          commandMs: call.end - call.start,
          error: call.error,
        });
        await waitQuiet(1000);
      }
      return { samples };
    });

    await phase('storyDocs', async () => {
      const visited = [];
      for (const storyId of project.docsEntryIds(DOCS)) {
        await previewFrame(tabs[0].page).evaluate(
          ([id]) => window.__STORYBOOK_ADDONS_CHANNEL__.emit('selectStory', { storyId: id }),
          [storyId]
        );
        await waitQuiet(1500);
        visited.push(storyId);
      }
      return { visited };
    });

    await phase('review', async () => {
      const storyIds = project.storyIds(100);
      const review = {
        title: 'Benchmark review',
        description: 'Generated by the perf harness.',
        collections: [0, 1, 2, 3].map((i) => ({
          title: `Collection ${i}`,
          rationale: 'Benchmark collection.',
          storyIds: storyIds.slice(i * 25, i * 25 + 25),
        })),
        changedFiles: [],
      };
      const calls = [];
      for (const [name, input] of [
        ['setReview', review],
        ['setReview', { ...review, title: 'Benchmark review, updated' }],
        ['acceptPending', undefined],
        ['markStale', undefined],
        ['dismissReview', undefined],
      ]) {
        const call = await tabs[0].page.evaluate(
          ([n, i]) => window.__perf.callCommand('core/review', n, i),
          [name, input]
        );
        calls.push({ name, commandMs: call.end - call.start, error: call.error });
        await waitQuiet(1000);
      }
      return { calls };
    });

    await phase('bootstrapTab2', async () => {
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await page.addInitScript(
        (id) => setTimeout(() => window.__perf.watch(id), 0),
        project.lastComponentId
      );
      const start = Date.now();
      await page.goto(`${baseUrl}/?path=/story/${project.firstStoryId}`);
      const managerAt = await page
        .waitForFunction(() => window.__perf?.watchHit, null, { timeout: 120_000 })
        .then((h) => h.jsonValue());
      await page.waitForFunction(
        () => document.querySelector('#storybook-preview-iframe')?.contentWindow?.__perf?.watchHit,
        null,
        { timeout: 120_000 }
      );
      const previewAt = await previewFrame(page).evaluate(() => window.__perf.watchHit);
      tabs.push({ name: 'tab2', page, cdp });
      return { managerFullStateMs: managerAt - start, previewFullStateMs: previewAt - start };
    });

    await phase('burstTwoTabs', async () => {
      const markers = [];
      for (const target of tabTwoTargets) {
        markers.push([target.componentId, await edit(target, ++revision)]);
        await sleep(EDIT_INTERVAL);
      }
      await waitQuiet(3000);
      const landed = {};
      for (const tab of tabs) {
        landed[tab.name] = await previewFrame(tab.page).evaluate(
          (pairs) =>
            pairs.filter(([id, marker]) => window.__perf.docgenText(id)?.includes(marker)).length,
          markers
        );
      }
      return { edits: markers.length, landedInPreview: landed };
    });
    results.heaps.end = await heaps();

    // Heap snapshots for tools/log-retained.mjs, taken last because they pause every runtime.
    if (opts['log-snapshot']) {
      const prefix = resolve(opts['log-snapshot']);
      results.snapshots = {
        server: (
          await ctx.control(`/snapshot?file=${encodeURIComponent(`${prefix}-server.heapsnapshot`)}`)
        ).file,
      };
      const tab = tabs[0];
      const out = createWriteStream(`${prefix}-tab1.heapsnapshot`);
      const onChunk = ({ chunk }) => out.write(chunk);
      tab.cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
      await tab.cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
      tab.cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
      await new Promise((r) => out.end(r));
      results.snapshots.tab1 = `${prefix}-tab1.heapsnapshot`;
      log('wrote heap snapshots');
    }
  },
};
