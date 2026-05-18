// Slim Playwright helpers for verify-recipes. Self-contained: no imports from
// code/e2e-tests/util.ts (which transitively pulls TS enums via cli-storybook).
// Recipes here are evaluated by Playwright's Node test workers, so anything
// that requires non-erasable TS is off-limits.

import { test as baseTest, expect as baseExpect } from '@playwright/test';
import type { Expect, FrameLocator, Locator, Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize } from 'node:path';

export class RecipePage {
  readonly page: Page;
  readonly expect: Expect;

  /**
   * Sanctioned scratch directory for recipes that must write fixtures /
   * config to disk to exercise a non-visual code path.
   *
   * `$PR_HEAD_DIR/.verify-scratch` is pre-created by the agentic-pr-prepare
   * composite and lies inside srt's `allowWrite` set (all of `$PR_HEAD_DIR`
   * is writable; `$GITHUB_WORKSPACE` and `.git` are denied). Writing here
   * keeps recipes off srt-denied paths WITHOUT loosening the egress jail.
   *
   * Both CI verify runs `cd $PR_HEAD_DIR` and export `PR_HEAD_DIR`; local-dev
   * has no such env so we fall back to cwd.
   */
  readonly scratchDir: string;

  constructor(page: Page, expect: Expect) {
    this.page = page;
    this.expect = expect;
    this.scratchDir = join(process.env.PR_HEAD_DIR ?? process.cwd(), '.verify-scratch');
  }

  /**
   * Write `contents` to `relPath` under {@link scratchDir}, creating parent
   * dirs as needed. `relPath` must be relative and stay inside the scratch
   * dir (no absolute paths, no `..` escape). Returns the absolute path so
   * the caller can hand it to the code under test.
   */
  writeFixture(relPath: string, contents: string): string {
    if (isAbsolute(relPath)) {
      throw new Error(`writeFixture: relPath must be relative, got "${relPath}"`);
    }
    const target = join(this.scratchDir, relPath);
    const normalizedRoot = normalize(this.scratchDir + '/');
    if (!normalize(target).startsWith(normalizedRoot)) {
      throw new Error(`writeFixture: "${relPath}" escapes the scratch dir`);
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
    return target;
  }

  previewIframe(): FrameLocator {
    return this.page.frameLocator('#storybook-preview-iframe');
  }

  previewRoot(): Locator {
    // Select whichever preview container actually has rendered children.
    // `:has(> *)` (not `:visible`) is deliberate: `layout: 'fullscreen'`
    // and the internal-ui side-by-side / stacked theme decorator wrap the
    // story so `#storybook-root` can have a zero-size (Playwright-"not
    // visible") box even though the story rendered fine. `:visible` then
    // matched nothing and `waitForStoryLoaded` timed out on a story that
    // had in fact loaded. `:has(> *)` keeps the story-vs-docs
    // disambiguation (the empty container is excluded) without the
    // bounding-box requirement.
    return this.previewIframe().locator('#storybook-root:has(> *), #storybook-docs:has(> *)');
  }

  async waitForStoryLoaded(): Promise<void> {
    await this.page.waitForURL((url) => url.search.includes('path'));
    const root = this.previewRoot();
    await root.locator(':scope > *').first().waitFor({ state: 'attached', timeout: 10_000 });
  }

  async waitUntilLoaded(): Promise<void> {
    await this.page.context().addInitScript(() => {
      const storeState = {
        layout: { showToolbar: true, navSize: 300, bottomPanelHeight: 300, rightPanelWidth: 300 },
      };
      window.sessionStorage.setItem('@storybook/manager/store', JSON.stringify(storeState));
    }, {});

    await this.page.addStyleTag({
      content: `*, *::before, *::after { transition: none !important; }`,
    });

    const root = this.previewRoot();
    await root.locator('.sb-preparing-docs').waitFor({ state: 'hidden' });
    await root.locator('.sb-preparing-story').waitFor({ state: 'hidden' });
    await this.waitForStoryLoaded();
  }
}

/**
 * `test` is extended with an auto-running fixture that, on failed/timed-out
 * tests, captures the preview iframe's accessibility snapshot to
 * `iframe-snapshot.md` inside the run directory (sibling of error-context.md).
 *
 * Playwright's built-in failure capture only snapshots the top-level manager
 * DOM — iframe content is opaque. The PR verify harness's retry-on-regression
 * step reads this file (when present) and feeds it into the next attempt's
 * recipe-author prompt, so the agent sees the actual story / preview DOM that
 * its locators tried to reach.
 */
export const test = baseTest.extend<{ recipeFailureCapture: void }>({
  recipeFailureCapture: [
    async ({ page }, use, testInfo) => {
      await use();
      if (testInfo.status === 'passed' || testInfo.status === 'skipped') return;
      try {
        const previewFrame = page
          .frames()
          .find((f) => /preview|iframe\.html/.test(f.url())) ?? page.frames()[1];
        if (!previewFrame) return;
        const snapshot = await previewFrame.locator('body').ariaSnapshot({ timeout: 4000 });
        const dir = testInfo.outputDir;
        writeFileSync(
          join(dir, 'iframe-snapshot.md'),
          `# Preview iframe snapshot at failure\n\n` +
            `Frame URL: ${previewFrame.url()}\n\n` +
            `\`\`\`yaml\n${snapshot}\n\`\`\`\n`
        );
        await testInfo.attach('iframe-snapshot', {
          body: snapshot,
          contentType: 'text/plain',
        });
      } catch {
        /* best-effort — no error must break the test reporter */
      }
    },
    { auto: true },
  ],
});

export const expect = baseExpect;

/**
 * Drop pre-existing environmental pageErrors that the manager surfaces in
 * CI through no fault of the PR under test. Use this on the array captured
 * by `page.on('pageerror', ...)` before the final assertion:
 *
 *   expect(filterPageErrors(pageErrors)).toEqual([]);
 *
 * Known low-signal entries:
 *  - `SecurityError: Failed to read the 'sessionStorage' property from
 *    'Window': Access is denied for this document.` — `@storybook/addon-mcp`
 *    probes cross-origin composed refs (chromatic-hosted iframes) loaded by
 *    internal-ui's main.ts. The denial fires on every internal-ui boot.
 */
export function filterPageErrors(pageErrors: readonly string[]): string[] {
  return pageErrors.filter((entry) => !isLowSignalPageError(entry));
}

function isLowSignalPageError(text: string): boolean {
  return /SecurityError:\s*Failed to read the 'sessionStorage' property from 'Window'/.test(text);
}
