import { expect, test, type Page } from '@playwright/test';
import process from 'process';

import { PREVIEW_STORY_TIMEOUT, waitForPreviewReady } from './helpers.ts';

/**
 * E2E regression for the open-service sync demos (`code/core/src/shared/open-service/sync-test`).
 *
 * Validates local command execution, remote command execution, static JSON loading, unhandled remote
 * commands in static builds, manager/preview sync, dev-server reload bootstrap, a second tab joining
 * written state and writing back, cross-tab relay, forced-concurrent two-tab writes, and gap repair
 * through a snapshot reply.
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

type ServiceFrame = {
  type: string;
  serviceId?: string;
  runtimeId?: string;
  seq?: number;
};

function parseServiceFrame(message: string | Buffer): ServiceFrame | undefined {
  const text = typeof message === 'string' ? message : message.toString('utf8');
  try {
    const event = JSON.parse(text) as {
      type?: string;
      args?: Array<{ serviceId?: string; runtimeId?: string; stamp?: { seq?: number } }>;
    };
    if (typeof event.type !== 'string' || !event.type.startsWith('services:')) {
      return undefined;
    }
    const payload = event.args?.[0];
    return {
      type: event.type,
      serviceId: payload?.serviceId,
      runtimeId: payload?.runtimeId,
      seq: typeof payload?.stamp?.seq === 'number' ? payload.stamp.seq : undefined,
    };
  } catch {
    return undefined;
  }
}

function readEntrySeq(message: string | Buffer): number | undefined {
  const frame = parseServiceFrame(message);
  return frame?.type === 'services:entry' ? frame.seq : undefined;
}

type EntryHold = {
  arm: () => void;
  release: () => void;
  seqs: () => number[];
};

type EntryDrop = {
  arm: () => void;
  disarm: () => void;
  /** `runtimeId` of every `services:sync-request` for the service sent since `arm()`. */
  requesters: () => string[];
};

// Discards `services:entry` frames the hub sends to this tab for one service while armed, and
// records who in the tab sends `services:sync-request` for that service. A dropped entry followed
// by a delivered one is a gap, the deterministic way to make the tab repair through a snapshot
// reply. In development the preview opens its own websocket to the server channel next to the
// manager's, and `routeWebSocket` sees both, so the manager runtime and the preview runtime each
// show up once. Same route rules as `holdOutboundEntries`: install before `goto`, stay idle until
// `arm()`.
async function dropInboundEntries(page: Page, serviceId: string): Promise<EntryDrop> {
  let dropping = false;
  let requesters: string[] = [];

  await page.routeWebSocket(/storybook-server-channel/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => {
      const frame = parseServiceFrame(message);
      if (
        frame?.type === 'services:sync-request' &&
        frame.serviceId === serviceId &&
        frame.runtimeId !== undefined
      ) {
        requesters.push(frame.runtimeId);
      }
      server.send(message);
    });
    server.onMessage((message) => {
      const frame = parseServiceFrame(message);
      if (dropping && frame?.type === 'services:entry' && frame.serviceId === serviceId) {
        return;
      }
      ws.send(message);
    });
  });

  return {
    arm: () => {
      dropping = true;
      requesters = [];
    },
    disarm: () => {
      dropping = false;
    },
    requesters: () => [...requesters],
  };
}

const CONCURRENT_WRITES_SERVICE_ID = 'storybook/internal/open-service-concurrent-writes-sync-demo';

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

  // The second tab opens after the first has written, so it starts from an empty vector and can
  // only show the value through a snapshot reply. Its write back proves the joiner is a full peer.
  test('local command syncs to a tab that joins written state', async ({ page, context }) => {
    test.skip(!runsAgainstDevServer, 'Cross-tab sync requires the dev-server relay channel.');

    const otherPage = await context.newPage();

    // Outer try guarantees the second tab is closed even if setup (navigation/visibility) throws.
    try {
      await gotoOpenServiceStory(
        page,
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

      try {
        await firstPanelInput.fill('local command: from first tab');
        await expect(firstStoryInput).toHaveValue('local command: from first tab');
        await expect(firstRawStoryValue).toHaveText(
          JSON.stringify('local command: from first tab')
        );

        await gotoOpenServiceStory(
          otherPage,
          'core-shared-open-service-sync-test-local-command--local-command-sync'
        );
        await expect(secondPanelInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
        await expect(secondStoryInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
        await expect(secondPanelInput).toHaveValue('local command: from first tab');
        await expect(secondStoryInput).toHaveValue('local command: from first tab');
        await expect(secondRawStoryValue).toHaveText(
          JSON.stringify('local command: from first tab')
        );

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

  test('remote command syncs to a tab that joins written state', async ({ page, context }) => {
    test.skip(!runsAgainstDevServer, 'Cross-tab sync requires the dev-server relay channel.');

    const otherPage = await context.newPage();

    // Outer try guarantees the second tab is closed even if setup (navigation/visibility) throws.
    try {
      await gotoOpenServiceStory(
        page,
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

      try {
        await firstPanelInput.fill('remote command: from first tab');
        await expect(firstStoryInput).toHaveValue('remote command: from first tab');
        await expect(firstRawStoryValue).toHaveText(
          JSON.stringify('remote command: from first tab')
        );

        await gotoOpenServiceStory(
          otherPage,
          'core-shared-open-service-sync-test-remote-command--remote-command-sync'
        );
        await expect(secondPanelInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
        await expect(secondStoryInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
        await expect(secondPanelInput).toHaveValue('remote command: from first tab');
        await expect(secondStoryInput).toHaveValue('remote command: from first tab');
        await expect(secondRawStoryValue).toHaveText(
          JSON.stringify('remote command: from first tab')
        );

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

  // Without a websocket route the hub is fast enough that tab B always observes tab A's write in
  // order, so the tests would only cover sequential seq 1 then 2 and never a concurrent stamp or
  // a gap.
  test.describe('two-tab writes under a websocket route', () => {
    // A passing retry would hide a broken hold or drop, so a failure here is a protocol bug, not
    // a flake.
    test.describe.configure({ retries: 0, mode: 'serial' });

    test('repairs a gap through a snapshot reply when an entry never arrives', async ({
      page,
      context,
    }) => {
      test.skip(!runsAgainstDevServer, 'Gap repair requires the dev-server relay channel.');

      const otherPage = await context.newPage();
      const drop = await dropInboundEntries(otherPage, CONCURRENT_WRITES_SERVICE_ID);

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
          await expectSlots(first.panelRaw, {});
          await expectSlots(second.panelRaw, {});

          const lostSlot = `lost-${Date.now()}`;
          const deliveredSlot = `delivered-${Date.now()}`;

          // The first write is discarded on its way to tab B. Only the tab A surfaces can show it.
          drop.arm();
          await first.panelSlot.fill(lostSlot);
          await first.panelValue.fill('L');
          await first.panelWrite.click();
          await expectSlots(first.panelRaw, { [lostSlot]: 'L' });
          await expectSlots(first.storyRaw, { [lostSlot]: 'L' });
          await expectSlots(second.panelRaw, {});
          drop.disarm();
          const requestersBeforeGap = drop.requesters();

          // The second write reaches tab B with a counter one ahead of what it holds. That gap
          // triggers a sync request, and the server's reply carries both slots.
          await first.panelSlot.fill(deliveredSlot);
          await first.panelValue.fill('D');
          await first.panelWrite.click();

          const expected = { [lostSlot]: 'L', [deliveredSlot]: 'D' };
          await expectSlots(second.panelRaw, expected);
          await expectSlots(second.storyRaw, expected);
          await expectSlots(first.panelRaw, expected);
          await expectSlots(first.storyRaw, expected);
          const requesters = drop.requesters();
          expect(
            requesters.length,
            'the lost slot can only arrive through a repair'
          ).toBeGreaterThan(requestersBeforeGap.length);
          const gapRequesters = requesters.slice(requestersBeforeGap.length);
          expect(new Set(gapRequesters).size, 'one request per runtime, no storm').toBe(
            gapRequesters.length
          );

          // The repaired tab is a full peer again: its next write lands everywhere in order.
          const afterSlot = `after-${Date.now()}`;
          await second.panelSlot.fill(afterSlot);
          await second.panelValue.fill('A');
          await second.panelWrite.click();
          const afterRepair = { ...expected, [afterSlot]: 'A' };
          await expectSlots(first.panelRaw, afterRepair);
          await expectSlots(first.storyRaw, afterRepair);
          await expectSlots(second.storyRaw, afterRepair);
          expect(drop.requesters(), 'an in-order write needs no repair').toStrictEqual(requesters);
        } finally {
          drop.disarm();
          await first.panelClear.click();
          await expectSlots(first.panelRaw, {});
          await expectSlots(second.panelRaw, {});
        }
      } finally {
        await otherPage.close();
      }
    });

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

          // Same key, same seq: the greater runtimeId wins, and runtimeIds are random,
          // so either value is correct; all four surfaces must show the same one.
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
