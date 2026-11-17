import { STORY_RENDER_PHASE_CHANGED } from 'storybook/internal/core-events';
import { SvelteKitMocksSharedOnDocsPageError } from '../errors.ts';

import { addons } from 'storybook/preview-api';

import type { Mock } from 'storybook/test';

/*
 * The SvelteKit mocks are module state, like SvelteKit's own modules. A docs page renders its
 * stories in one document, so stories that set the mocks would all show the setup of the story
 * that set them last. Nothing can tell which story sets a mock, so instead of rendering a wrong
 * story, the framework throws as soon as stories on one docs page could share mock setup, and the
 * error tells the user to render those stories in iframes.
 *
 * Only setup counts: a write between the start of a story's `beforeEach` and its mount. A form
 * submit or a click in a rendered story changes only what that story shows.
 */

// The stories rendering on the current docs page, by canvas element, because the primary story
// and its copy in the list of stories are two renders of one story
const renders = new Map<Element, { storyId: string; settingUp: boolean }>();
let mocksSetOnPage = false;
let resetting = false;

// Core runs the cleanup of a story only when every `beforeEach` succeeds, so a story that failed
// in its setup stays here when the user leaves the page. The page removes its canvas element.
const forgetRemovedRenders = () => {
  for (const canvasElement of renders.keys()) {
    if (!canvasElement.isConnected) {
      renders.delete(canvasElement);
    }
  }
  if (renders.size === 0) {
    mocksSetOnPage = false;
  }
};

const hasOtherStory = (storyId: string) =>
  [...renders.values()].some((render) => render.storyId !== storyId);
const isSettingUp = () => [...renders.values()].some((render) => render.settingUp);

const sharedError = () => new SvelteKitMocksSharedOnDocsPageError();

let listening = false;

// A story that fails in a later `beforeEach` never mounts, and core keeps it on the page with its
// error, so its setup ends when it fails. The event names only the story, so this ends the setup of
// every copy of it, which run the same `beforeEach`
const listenForFailures = () => {
  if (listening) {
    return;
  }
  listening = true;
  addons
    .getChannel()
    .on(
      STORY_RENDER_PHASE_CHANGED,
      ({ newPhase, storyId }: { newPhase: string; storyId: string }) => {
        if (newPhase !== 'errored') {
          return;
        }
        for (const render of renders.values()) {
          if (render.storyId === storyId) {
            render.settingUp = false;
          }
        }
      }
    );
};

/**
 * Called by the framework `beforeEach` of a story on a docs page, before it resets the mocks.
 * Throws when another story on the page already set the mocks. Returns the cleanup.
 *
 * `mocksChanged` tells if the current values differ from the defaults, such as after `page.data.user
 * = user`, which no setter sees. It counts only while a story is set up, because a rendered story
 * can change them, such as in a play function.
 */
export function beginDocsStory(storyId: string, canvasElement: Element, mocksChanged: boolean) {
  listenForFailures();
  forgetRemovedRenders();
  if ((mocksSetOnPage || (mocksChanged && isSettingUp())) && hasOtherStory(storyId)) {
    throw sharedError();
  }
  renders.set(canvasElement, { storyId, settingUp: true });
  return () => {
    renders.delete(canvasElement);
    if (renders.size === 0) {
      mocksSetOnPage = false;
    }
  };
}

/** Called when a story on a docs page mounts, which ends its setup. */
export function endDocsSetup(canvasElement: Element, mocksChanged: boolean) {
  const render = renders.get(canvasElement);
  if (!render?.settingUp) {
    return;
  }
  if (mocksChanged) {
    noteMockSet();
  }
  render.settingUp = false;
}

/** Called by every write to a SvelteKit mock. Throws when stories on a docs page would share it. */
export function noteMockSet() {
  forgetRemovedRenders();
  if (resetting || !isSettingUp()) {
    return;
  }
  if (new Set([...renders.values()].map((render) => render.storyId)).size >= 2) {
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
