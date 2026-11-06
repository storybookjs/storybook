import { STORY_RENDER_PHASE_CHANGED } from 'storybook/internal/core-events';
import { SvelteKitMocksSharedOnDocsPageError } from 'storybook/internal/preview-errors';

import { addons } from 'storybook/preview-api';
import type { Mock } from 'storybook/test';

/*
 * The SvelteKit mocks are module state, like SvelteKit's own modules. A docs page renders its
 * stories in one document, so stories that set the mocks would all show the setup of the story
 * that set them last. Nothing can tell which story sets a mock, so instead of rendering a wrong
 * story, the framework throws as soon as stories on one docs page could share mock setup, and the
 * error tells the user to render those stories in iframes.
 *
 * Only setup counts: a write between the start of a story's `beforeEach` and its render. A form
 * submit or a click in a rendered story changes only what that story shows.
 */

// The stories set up on the current docs page, and the ones whose `beforeEach` is still running
const storiesOnPage = new Set<string>();
const storiesSettingUp = new Set<string>();
let mocksSetOnPage = false;
let resetting = false;
let listening = false;

const phasesBeforeRender = ['preparing', 'loading'];

const listenForRenders = () => {
  if (listening) {
    return;
  }
  listening = true;
  // A story's setup ends when core starts to render it
  addons
    .getChannel()
    .on(
      STORY_RENDER_PHASE_CHANGED,
      ({ newPhase, storyId }: { newPhase: string; storyId: string }) => {
        if (!phasesBeforeRender.includes(newPhase)) {
          storiesSettingUp.delete(storyId);
        }
      }
    );
};

const sharedError = () => new SvelteKitMocksSharedOnDocsPageError();

/**
 * Called by the framework `beforeEach` of a story on a docs page, before it resets the mocks.
 * Throws when another story on the page already set the mocks. Returns the cleanup.
 */
export function beginDocsStory(storyId: string) {
  listenForRenders();
  if (mocksSetOnPage && !storiesOnPage.has(storyId) && storiesOnPage.size >= 1) {
    throw sharedError();
  }
  storiesOnPage.add(storyId);
  storiesSettingUp.add(storyId);
  return () => {
    storiesOnPage.delete(storyId);
    storiesSettingUp.delete(storyId);
    if (storiesOnPage.size === 0) {
      mocksSetOnPage = false;
    }
  };
}

/** Called by every write to a SvelteKit mock. Throws when stories on a docs page would share it. */
export function noteMockSet() {
  if (resetting || storiesSettingUp.size === 0) {
    return;
  }
  if (storiesOnPage.size >= 2) {
    throw sharedError();
  }
  mocksSetOnPage = true;
}

/** Runs the framework's own reset of the mocks, which doesn't count as setting them. */
export function resetMocks(reset: () => void) {
  resetting = true;
  try {
    reset();
  } finally {
    resetting = false;
  }
}

/** Makes configuring a mock function, such as with `mockResolvedValue`, count as setting it. */
export function noteConfiguration<T extends Mock<any>>(mock: T): T {
  // The other configuration methods, such as `mockResolvedValue`, call these two
  for (const method of ['mockImplementation', 'mockImplementationOnce', 'withImplementation']) {
    const original = (mock as any)[method];
    (mock as any)[method] = (...args: unknown[]) => {
      noteMockSet();
      return original(...args);
    };
  }
  return mock;
}
