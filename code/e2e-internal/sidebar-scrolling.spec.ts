import { expect, test } from '@playwright/test';
import process from 'process';

/**
 * The sidebar gives the local stories tree and every ref block one scroll area. These checks need a
 * real scroll environment: the tree is virtualized, and react-aria's virtual scroll view reports an
 * unbounded size under NODE_ENV=test, so the geometry in a story test is not representative.
 */

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';

const SCROLL_AREA = '[data-testid="sidebar-scroll-area"]';
const STICKY_ROWS = '[data-testid="sticky-overlay"]';

test.describe('sidebar scrolling', () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await page.locator(SCROLL_AREA).waitFor();
    await expect(page.locator('[data-item-id]').first()).toBeVisible();
  });

  test('scrolls every block in one scroll area', async ({ page }) => {
    const scrollArea = page.locator(SCROLL_AREA);

    // One scroll area holds more content than it can show, and no tree scrolls itself.
    const geometry = await scrollArea.evaluate((area) => ({
      scrolls: area.scrollHeight > area.clientHeight + 1,
      selfScrollingTrees: [...document.querySelectorAll('[role="treegrid"]')].filter(
        (tree) => tree.scrollHeight > tree.clientHeight + 1
      ).length,
    }));
    expect(geometry.scrolls).toBe(true);
    expect(geometry.selfScrollingTrees).toBe(0);

    // The last row comes to rest above the floating sidebar-bottom widget, which the scroll area
    // reserves room for, rather than behind it.
    await scrollArea.evaluate((area) => {
      area.scrollTop = area.scrollHeight;
    });
    const clearance = await page.evaluate(() => {
      const widget = document.querySelector('#sidebar-bottom-wrapper');
      const rows = [...document.querySelectorAll('[data-item-id]')];
      const lastRow = rows[rows.length - 1];
      if (!widget || !lastRow) {
        return null;
      }
      return lastRow.getBoundingClientRect().bottom <= widget.getBoundingClientRect().top;
    });
    expect(clearance).not.toBeNull();
    expect(clearance).toBe(true);
  });

  test('keeps a row moved to with the keyboard clear of the sticky rows', async ({ page }) => {
    const scrollArea = page.locator(SCROLL_AREA);
    await scrollArea.evaluate((area) => {
      area.scrollTop = 1500;
    });
    await expect(page.locator(STICKY_ROWS)).toBeVisible();

    const rowIds = await page.evaluate(() =>
      [...document.querySelectorAll('[data-item-id]')].map((row) =>
        row.getAttribute('data-item-id')
      )
    );
    await page.click(`[data-item-id="${rowIds[Math.floor(rowIds.length / 2)]}"]`);

    const measure = () =>
      page.evaluate(
        ([stickySelector, areaSelector]) => {
          const focused = document.querySelector('[data-item-id][data-focused="true"]');
          const sticky = document.querySelector(stickySelector);
          const area = document.querySelector(areaSelector);
          if (!focused || !area) {
            return null;
          }
          const stackBottom = sticky
            ? sticky.getBoundingClientRect().bottom
            : area.getBoundingClientRect().top;
          return { rowTop: focused.getBoundingClientRect().top, stackBottom };
        },
        [STICKY_ROWS, SCROLL_AREA]
      );

    // React-aria only scrolls a focused row inside the raw viewport, so a row behind the sticky
    // rows would count as visible and stay hidden. The tree scrolls it clear of them instead.
    for (let press = 0; press < 12; press += 1) {
      await page.keyboard.press('ArrowUp');
      await expect
        .poll(async () => {
          const spot = await measure();
          return spot === null
            ? false
            : Math.round(spot.rowTop) >= Math.round(spot.stackBottom) - 1;
        })
        .toBe(true);
    }
  });
});
