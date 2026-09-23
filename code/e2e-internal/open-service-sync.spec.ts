import { expect, test, type Page } from '@playwright/test';
import process from 'process';

import { PREVIEW_STORY_TIMEOUT, waitForPreviewReady } from './helpers.ts';

/**
 * E2E regression for the open-service sync demos (`code/core/src/shared/open-service/sync-test`).
 *
 * Validates local command execution, remote command execution, static JSON loading, unhandled remote
 * commands in static builds, manager/preview sync, dev-server reload bootstrap, cross-tab relay, and
 * forced-concurrent two-tab writes.
 */

/** Internal Storybook UI (`code/.storybook`) — not a sandbox template. */
const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';

const runsAgainstDevServer = !['build', 'static'].includes(process.env.STORYBOOK_TYPE || 'dev');
const STORY_READY_TIMEOUT = PREVIEW_STORY_TIMEOUT;
const STATIC_LOAD_TIMEOUT = 20_000;

async function openOpenServicePanel(page: Page) {
  const tab = page.getByRole('tab', { name: /^Open Service/ });
  await expect(tab).toBeVisible({ timeout: STORY_READY_TIMEOUT });
  await tab.click();
  await expect(page.locator('#storybook-panel-root').getByRole('tabpanel')).toBeVisible();
}

async function gotoOpenServiceStory(page: Page, storyPath: string) {
  await page.goto(`${storybookUrl}/?path=/story/${storyPath}`);
  await waitForPreviewReady(page);
  await openOpenServicePanel(page);
}

function readEntrySeq(message: string | Buffer): number | undefined {
  const text = typeof message === 'string' ? message : message.toString('utf8');
  try {
    const event = JSON.parse(text) as {
      type?: string;
      args?: Array<{ stamp?: { seq?: number } }>;
    };
    if (event.type !== 'services:entry') {
      return undefined;
    }
    const seq = event.args?.[0]?.stamp?.seq;
    return typeof seq === 'number' ? seq : undefined;
  } catch {
    return undefined;
  }
}

type EntryHold = {
  arm: () => void;
  release: () => void;
  seqs: () => number[];
};

// Only the manager's server socket carries `services:entry` to the hub, so holding its outbound
// entry frames keeps each tab from seeing the other's write while both still stamp locally. Equal
// seq after both clicks is the proof the writes were concurrent. The route must be installed
// before `goto`, must stay idle until `arm()` so bootstrap traffic is not queued, and must hold
// only entry frames, or the UI never loads.
async function holdOutboundEntries(page: Page): Promise<EntryHold> {
  let holding = false;
  const held: Array<{ send: (message: string | Buffer) => void; message: string | Buffer }> = [];

  await page.routeWebSocket(/storybook-server-channel/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => {
      if (holding && readEntrySeq(message) !== undefined) {
        held.push({ send: (payload) => server.send(payload), message });
        return;
      }
      server.send(message);
    });
  });

  return {
    arm: () => {
      holding = true;
      held.length = 0;
    },
    release: () => {
      holding = false;
      const pending = held.splice(0, held.length);
      for (const item of pending) {
        item.send(item.message);
      }
    },
    seqs: () =>
      held
        .map((item) => readEntrySeq(item.message))
        .filter((seq): seq is number => seq !== undefined),
  };
}

function concurrentWritesControls(page: Page) {
  const story = page.frameLocator('#storybook-preview-iframe');
  return {
    panelSlot: page.getByRole('textbox', {
      name: 'Concurrent writes manager panel slot input',
    }),
    panelValue: page.getByRole('textbox', {
      name: 'Concurrent writes manager panel value input',
    }),
    panelWrite: page.getByRole('button', { name: 'Concurrent writes manager panel write' }),
    panelClear: page.getByRole('button', {
      name: 'Concurrent writes manager panel clear slots',
    }),
    panelRaw: page.getByTestId('concurrent-writes-manager-panel-raw-service-state-slots'),
    storyRaw: story.getByTestId('concurrent-writes-raw-service-state-slots'),
  };
}

// Manager panel and preview iframe subscribe separately and can lag. Poll the
// raw JSON text until it matches, rather than reading once after release.
async function expectSlots(raw: ReturnType<Page['getByTestId']>, expected: Record<string, string>) {
  await expect
    .poll(async () => JSON.parse((await raw.textContent()) ?? '{}') as Record<string, string>, {
      timeout: 10_000,
    })
    .toStrictEqual(expected);
}

test.describe('open-service sync example', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60_000);

  test('local command syncs the manager panel and story inputs', async ({ page }) => {
    await gotoOpenServiceStory(
      page,
      'core-shared-open-service-sync-test-local-command--local-command-sync'
    );

    const panelInput = page.getByRole('textbox', {
      name: 'Local command manager panel sync input',
    });
    const storyInput = page
      .frameLocator('#storybook-preview-iframe')
      .getByRole('textbox', { name: 'Local command story sync input' });
    const rawStoryValue = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('local-command-raw-service-state-value');

    await expect(panelInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await expect(storyInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });

    try {
      await panelInput.fill('local command: from panel');
      await expect(storyInput).toHaveValue('local command: from panel');
      await expect(rawStoryValue).toHaveText(JSON.stringify('local command: from panel'));

      await storyInput.fill('local command: from story');
      await expect(panelInput).toHaveValue('local command: from story');
      await expect(rawStoryValue).toHaveText(JSON.stringify('local command: from story'));
    } finally {
      await panelInput.fill('');
      await expect(storyInput).toHaveValue('');
      await expect(rawStoryValue).toHaveText(JSON.stringify(''));
    }
  });

  test('local command persists state across reloads in dev', async ({ page }) => {
    test.skip(!runsAgainstDevServer, 'Reload persistence requires the dev-server relay channel.');

    await gotoOpenServiceStory(
      page,
      'core-shared-open-service-sync-test-local-command--local-command-sync'
    );

    const panelInput = page.getByRole('textbox', {
      name: 'Local command manager panel sync input',
    });
    const storyInput = page
      .frameLocator('#storybook-preview-iframe')
      .getByRole('textbox', { name: 'Local command story sync input' });
    const rawStoryValue = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('local-command-raw-service-state-value');

    await expect(panelInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await expect(storyInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });

    try {
      await storyInput.fill('local command: before reload');
      await expect(panelInput).toHaveValue('local command: before reload');

      await page.reload();
      await waitForPreviewReady(page);
      await openOpenServicePanel(page);

      await expect(panelInput).toHaveValue('local command: before reload');
      await expect(storyInput).toHaveValue('local command: before reload');
      await expect(rawStoryValue).toHaveText(JSON.stringify('local command: before reload'));
    } finally {
      await panelInput.fill('');
      await expect(storyInput).toHaveValue('');
      await expect(rawStoryValue).toHaveText(JSON.stringify(''));
    }
  });

  test('local command syncs across multiple open tabs', async ({ page, context }) => {
    test.skip(!runsAgainstDevServer, 'Cross-tab sync requires the dev-server relay channel.');

    const otherPage = await context.newPage();

    // Outer try guarantees the second tab is closed even if setup (navigation/visibility) throws.
    try {
      await gotoOpenServiceStory(
        page,
        'core-shared-open-service-sync-test-local-command--local-command-sync'
      );
      await gotoOpenServiceStory(
        otherPage,
        'core-shared-open-service-sync-test-local-command--local-command-sync'
      );

      const firstPanelInput = page.getByRole('textbox', {
        name: 'Local command manager panel sync input',
      });
      const firstStoryInput = page
        .frameLocator('#storybook-preview-iframe')
        .getByRole('textbox', { name: 'Local command story sync input' });
      const firstRawStoryValue = page
        .frameLocator('#storybook-preview-iframe')
        .getByTestId('local-command-raw-service-state-value');
      const secondPanelInput = otherPage.getByRole('textbox', {
        name: 'Local command manager panel sync input',
      });
      const secondStoryInput = otherPage
        .frameLocator('#storybook-preview-iframe')
        .getByRole('textbox', { name: 'Local command story sync input' });
      const secondRawStoryValue = otherPage
        .frameLocator('#storybook-preview-iframe')
        .getByTestId('local-command-raw-service-state-value');

      await expect(firstPanelInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
      await expect(firstStoryInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
      await expect(secondPanelInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
      await expect(secondStoryInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });

      try {
        await firstPanelInput.fill('');
        await expect(firstStoryInput).toHaveValue('');
        await expect(firstRawStoryValue).toHaveText(JSON.stringify(''));
        await expect(secondStoryInput).toHaveValue('');
        await expect(secondRawStoryValue).toHaveText(JSON.stringify(''));

        await firstPanelInput.fill('local command: from first tab');
        await expect(secondStoryInput).toHaveValue('local command: from first tab');
        await expect(secondRawStoryValue).toHaveText(
          JSON.stringify('local command: from first tab')
        );
        await expect(secondPanelInput).toHaveValue('local command: from first tab');

        await secondStoryInput.fill('local command: from second tab');
        await expect(firstPanelInput).toHaveValue('local command: from second tab');
        await expect(firstStoryInput).toHaveValue('local command: from second tab');
        await expect(firstRawStoryValue).toHaveText(
          JSON.stringify('local command: from second tab')
        );
      } finally {
        await firstPanelInput.fill('');
        await expect(firstStoryInput).toHaveValue('');
        await expect(firstRawStoryValue).toHaveText(JSON.stringify(''));
      }
    } finally {
      await otherPage.close();
    }
  });

  test('remote command syncs the manager panel and story inputs', async ({ page }) => {
    test.skip(!runsAgainstDevServer, 'Remote commands require the dev-server command handler.');

    await gotoOpenServiceStory(
      page,
      'core-shared-open-service-sync-test-remote-command--remote-command-sync'
    );

    const panelInput = page.getByRole('textbox', {
      name: 'Remote command manager panel sync input',
    });
    const storyInput = page
      .frameLocator('#storybook-preview-iframe')
      .getByRole('textbox', { name: 'Remote command story sync input' });
    const rawStoryValue = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('remote-command-raw-service-state-value');

    await expect(panelInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await expect(storyInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });

    try {
      await panelInput.fill('remote command: from panel');
      await expect(storyInput).toHaveValue('remote command: from panel');
      await expect(rawStoryValue).toHaveText(JSON.stringify('remote command: from panel'));

      await storyInput.fill('remote command: from story');
      await expect(panelInput).toHaveValue('remote command: from story');
      await expect(rawStoryValue).toHaveText(JSON.stringify('remote command: from story'));
    } finally {
      await panelInput.fill('');
      await expect(storyInput).toHaveValue('');
      await expect(rawStoryValue).toHaveText(JSON.stringify(''));
    }
  });

  test('remote command persists state across reloads in dev', async ({ page }) => {
    test.skip(!runsAgainstDevServer, 'Reload persistence requires the dev-server relay channel.');

    await gotoOpenServiceStory(
      page,
      'core-shared-open-service-sync-test-remote-command--remote-command-sync'
    );

    const panelInput = page.getByRole('textbox', {
      name: 'Remote command manager panel sync input',
    });
    const storyInput = page
      .frameLocator('#storybook-preview-iframe')
      .getByRole('textbox', { name: 'Remote command story sync input' });
    const rawStoryValue = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('remote-command-raw-service-state-value');

    await expect(panelInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await expect(storyInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });

    try {
      await storyInput.fill('remote command: before reload');
      await expect(panelInput).toHaveValue('remote command: before reload');

      await page.reload();
      await waitForPreviewReady(page);
      await openOpenServicePanel(page);

      await expect(panelInput).toHaveValue('remote command: before reload');
      await expect(storyInput).toHaveValue('remote command: before reload');
      await expect(rawStoryValue).toHaveText(JSON.stringify('remote command: before reload'));
    } finally {
      await panelInput.fill('');
      await expect(storyInput).toHaveValue('');
      await expect(rawStoryValue).toHaveText(JSON.stringify(''));
    }
  });

  test('remote command syncs across multiple open tabs', async ({ page, context }) => {
    test.skip(!runsAgainstDevServer, 'Cross-tab sync requires the dev-server relay channel.');

    const otherPage = await context.newPage();

    // Outer try guarantees the second tab is closed even if setup (navigation/visibility) throws.
    try {
      await gotoOpenServiceStory(
        page,
        'core-shared-open-service-sync-test-remote-command--remote-command-sync'
      );
      await gotoOpenServiceStory(
        otherPage,
        'core-shared-open-service-sync-test-remote-command--remote-command-sync'
      );

      const firstPanelInput = page.getByRole('textbox', {
        name: 'Remote command manager panel sync input',
      });
      const firstStoryInput = page
        .frameLocator('#storybook-preview-iframe')
        .getByRole('textbox', { name: 'Remote command story sync input' });
      const firstRawStoryValue = page
        .frameLocator('#storybook-preview-iframe')
        .getByTestId('remote-command-raw-service-state-value');
      const secondPanelInput = otherPage.getByRole('textbox', {
        name: 'Remote command manager panel sync input',
      });
      const secondStoryInput = otherPage
        .frameLocator('#storybook-preview-iframe')
        .getByRole('textbox', { name: 'Remote command story sync input' });
      const secondRawStoryValue = otherPage
        .frameLocator('#storybook-preview-iframe')
        .getByTestId('remote-command-raw-service-state-value');

      await expect(firstPanelInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
      await expect(firstStoryInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
      await expect(secondPanelInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
      await expect(secondStoryInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });

      try {
        await firstPanelInput.fill('');
        await expect(firstStoryInput).toHaveValue('');
        await expect(firstRawStoryValue).toHaveText(JSON.stringify(''));
        await expect(secondStoryInput).toHaveValue('');
        await expect(secondRawStoryValue).toHaveText(JSON.stringify(''));

        await firstPanelInput.fill('remote command: from first tab');
        await expect(secondStoryInput).toHaveValue('remote command: from first tab');
        await expect(secondRawStoryValue).toHaveText(
          JSON.stringify('remote command: from first tab')
        );
        await expect(secondPanelInput).toHaveValue('remote command: from first tab');

        await secondStoryInput.fill('remote command: from second tab');
        await expect(firstPanelInput).toHaveValue('remote command: from second tab');
        await expect(firstStoryInput).toHaveValue('remote command: from second tab');
        await expect(firstRawStoryValue).toHaveText(
          JSON.stringify('remote command: from second tab')
        );
      } finally {
        await firstPanelInput.fill('');
        await expect(firstStoryInput).toHaveValue('');
        await expect(firstRawStoryValue).toHaveText(JSON.stringify(''));
      }
    } finally {
      await otherPage.close();
    }
  });

  test('static load resolves entries from the live server in dev', async ({ page }) => {
    test.skip(!runsAgainstDevServer, 'Live server commands are only available in dev mode.');

    await gotoOpenServiceStory(
      page,
      'core-shared-open-service-sync-test-static-load--static-load-sync'
    );

    const panelAlpha = page.getByTestId('static-load-manager-panel-entry-alpha-value');
    const panelBeta = page.getByTestId('static-load-manager-panel-entry-beta-value');
    const panelUnbacked = page.getByTestId('static-load-manager-panel-unbacked-status');
    const storyAlpha = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('static-load-story-entry-alpha-value');
    const storyBeta = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('static-load-story-entry-beta-value');
    const storyUnbacked = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('static-load-story-unbacked-status');

    await expect(panelAlpha).toHaveText(JSON.stringify('static-load:alpha'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });
    await expect(panelBeta).toHaveText(JSON.stringify('static-load:beta'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });
    await expect(panelUnbacked).toHaveText(JSON.stringify('static-load:unbacked'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });
    await expect(storyAlpha).toHaveText(JSON.stringify('static-load:alpha'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });
    await expect(storyBeta).toHaveText(JSON.stringify('static-load:beta'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });
    await expect(storyUnbacked).toHaveText(JSON.stringify('static-load:unbacked'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });
  });

  test('two writers, one after the other, both land in the panel and the story', async ({
    page,
  }) => {
    await gotoOpenServiceStory(
      page,
      'core-shared-open-service-sync-test-concurrent-writes--concurrent-writes-sync'
    );

    const panelSlot = page.getByRole('textbox', {
      name: 'Concurrent writes manager panel slot input',
    });
    const panelValue = page.getByRole('textbox', {
      name: 'Concurrent writes manager panel value input',
    });
    const panelWrite = page.getByRole('button', { name: 'Concurrent writes manager panel write' });
    const panelClear = page.getByRole('button', {
      name: 'Concurrent writes manager panel clear slots',
    });
    const panelRaw = page.getByTestId('concurrent-writes-manager-panel-raw-service-state-slots');
    const story = page.frameLocator('#storybook-preview-iframe');
    const storySlot = story.getByRole('textbox', { name: 'Concurrent writes story slot input' });
    const storyValue = story.getByRole('textbox', { name: 'Concurrent writes story value input' });
    const storyWrite = story.getByRole('button', { name: 'Concurrent writes story write' });
    const storyRaw = story.getByTestId('concurrent-writes-raw-service-state-slots');

    await expect(panelSlot).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await expect(storySlot).toBeVisible({ timeout: STORY_READY_TIMEOUT });

    try {
      await panelClear.click();
      await expect(panelRaw).toHaveText('{}');
      await expect(storyRaw).toHaveText('{}');

      await panelSlot.fill('panel-slot');
      await panelValue.fill('from-panel');
      await panelWrite.click();

      const afterPanel = JSON.stringify({ 'panel-slot': 'from-panel' });
      await expect(panelRaw).toHaveText(afterPanel);
      await expect(storyRaw).toHaveText(afterPanel);

      await storySlot.fill('story-slot');
      await storyValue.fill('from-story');
      await storyWrite.click();

      const afterBoth = JSON.stringify({ 'panel-slot': 'from-panel', 'story-slot': 'from-story' });
      await expect(panelRaw).toHaveText(afterBoth);
      await expect(storyRaw).toHaveText(afterBoth);
    } finally {
      await panelClear.click();
      await expect(panelRaw).toHaveText('{}');
      await expect(storyRaw).toHaveText('{}');
    }
  });

  // Without the websocket hold the hub is fast enough that tab B usually observes tab A's write
  // before B authors, so the test would only cover sequential seq 1 then 2.
  test.describe('two-tab concurrent writes', () => {
    // A passing retry would hide a broken hold, so a failure here is a protocol bug, not a flake.
    test.describe.configure({ retries: 0, mode: 'serial' });

    test('keeps both keys and the same seq when two tabs write under a hold', async ({
      page,
      context,
    }) => {
      test.skip(
        !runsAgainstDevServer,
        'Cross-tab concurrency requires the dev-server relay channel.'
      );

      const otherPage = await context.newPage();
      const firstHold = await holdOutboundEntries(page);
      const secondHold = await holdOutboundEntries(otherPage);

      try {
        await gotoOpenServiceStory(
          page,
          'core-shared-open-service-sync-test-concurrent-writes--concurrent-writes-sync'
        );
        await gotoOpenServiceStory(
          otherPage,
          'core-shared-open-service-sync-test-concurrent-writes--concurrent-writes-sync'
        );

        const first = concurrentWritesControls(page);
        const second = concurrentWritesControls(otherPage);

        await expect(first.panelSlot).toBeVisible({ timeout: STORY_READY_TIMEOUT });
        await expect(second.panelSlot).toBeVisible({ timeout: STORY_READY_TIMEOUT });

        try {
          await first.panelClear.click();
          await expect(first.panelRaw).toHaveText('{}', { timeout: 10_000 });
          await expect(second.panelRaw).toHaveText('{}', { timeout: 10_000 });

          // Three rounds so one lucky delivery order does not pass the suite.
          for (let round = 0; round < 3; round += 1) {
            // Fresh keys: clear is a replicated command. Reusing a slot while a
            // slow clear is in flight looks like a lost write.
            const leftSlot = `left-${round}-${Date.now()}`;
            const rightSlot = `right-${round}-${Date.now()}`;
            const leftValue = `L${round}`;
            const rightValue = `R${round}`;

            firstHold.arm();
            secondHold.arm();

            await first.panelSlot.fill(leftSlot);
            await first.panelValue.fill(leftValue);
            await first.panelWrite.click();
            await second.panelSlot.fill(rightSlot);
            await second.panelValue.fill(rightValue);
            await second.panelWrite.click();

            // Compare seq while frames are still queued. After release the hub
            // places both entries and fans them back; seqs() then goes empty.
            await expect.poll(() => firstHold.seqs().length).toBe(1);
            await expect.poll(() => secondHold.seqs().length).toBe(1);
            expect(firstHold.seqs()[0], 'equal seq proves the writes were concurrent').toBe(
              secondHold.seqs()[0]
            );

            firstHold.release();
            secondHold.release();

            const expected = { [leftSlot]: leftValue, [rightSlot]: rightValue };
            await expectSlots(first.panelRaw, expected);
            await expectSlots(first.storyRaw, expected);
            await expectSlots(second.panelRaw, expected);
            await expectSlots(second.storyRaw, expected);

            await first.panelClear.click();
            await expectSlots(first.panelRaw, {});
            await expectSlots(second.panelRaw, {});
          }

          // Same key, same seq: last-write-wins. Either value is correct; all
          // four surfaces must show the same one.
          const sharedSlot = `shared-${Date.now()}`;
          firstHold.arm();
          secondHold.arm();
          await first.panelSlot.fill(sharedSlot);
          await first.panelValue.fill('alpha');
          await first.panelWrite.click();
          await second.panelSlot.fill(sharedSlot);
          await second.panelValue.fill('beta');
          await second.panelWrite.click();
          await expect.poll(() => firstHold.seqs().length).toBe(1);
          await expect.poll(() => secondHold.seqs().length).toBe(1);
          expect(firstHold.seqs()[0]).toBe(secondHold.seqs()[0]);
          firstHold.release();
          secondHold.release();

          await expect
            .poll(
              async () => {
                const surfaces = [first.panelRaw, first.storyRaw, second.panelRaw, second.storyRaw];
                const values: Array<string | undefined> = [];
                for (const raw of surfaces) {
                  const slots = JSON.parse((await raw.textContent()) ?? '{}') as Record<
                    string,
                    string
                  >;
                  values.push(slots[sharedSlot]);
                }
                if (values.some((value) => value !== values[0])) {
                  return undefined;
                }
                return values[0];
              },
              { timeout: 10_000 }
            )
            .toMatch(/^(alpha|beta)$/);
        } finally {
          // A failure mid-hold leaves frames queued; drain them so the next
          // test does not wait on a socket that never forwards.
          firstHold.release();
          secondHold.release();
          await first.panelClear.click();
          await expectSlots(first.panelRaw, {});
        }
      } finally {
        await otherPage.close();
      }
    });
  });

  test('static load reads prebuilt JSON and rejects unbacked commands in a static build', async ({
    page,
  }) => {
    test.skip(runsAgainstDevServer, 'Prebuilt JSON assertions require a static Storybook build.');

    await gotoOpenServiceStory(
      page,
      'core-shared-open-service-sync-test-static-load--static-load-sync'
    );

    const panelAlpha = page.getByTestId('static-load-manager-panel-entry-alpha-value');
    const panelBeta = page.getByTestId('static-load-manager-panel-entry-beta-value');
    const panelUnbacked = page.getByTestId('static-load-manager-panel-unbacked-status');
    const storyAlpha = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('static-load-story-entry-alpha-value');
    const storyBeta = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('static-load-story-entry-beta-value');
    const storyUnbacked = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('static-load-story-unbacked-status');

    await expect(panelAlpha).toHaveText(JSON.stringify('static-load:alpha'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });
    await expect(panelBeta).toHaveText(JSON.stringify('static-load:beta'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });
    await expect(storyAlpha).toHaveText(JSON.stringify('static-load:alpha'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });
    await expect(storyBeta).toHaveText(JSON.stringify('static-load:beta'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });

    await expect(panelUnbacked).toContainText('No runtime acknowledged remote command', {
      timeout: STATIC_LOAD_TIMEOUT,
    });
    await expect(storyUnbacked).toContainText('No runtime acknowledged remote command', {
      timeout: STATIC_LOAD_TIMEOUT,
    });
  });
});
