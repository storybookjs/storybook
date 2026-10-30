import { describe, expect, it } from 'vitest';

import { INITIAL_VIEWPORTS, MINIMAL_VIEWPORTS } from 'storybook/viewport';

import {
  applyAddressedUpdate,
  createAddressedPreview,
  resetAddressedPreview,
} from '../../../../core/src/preview-api/modules/store/addressed-preview.ts';
import { MAIN_CANVAS_ID } from '../constants.ts';
import {
  mountDocsInstances,
  releaseDocsFrames,
  withInstanceGlobals,
  writeDocsInstanceGlobals,
} from './docs-page.ts';
import { COMPACT_FRAME_MIN_HEIGHT, displayedFrameHeight, storyFrameStyle } from './frame-height.ts';
import { DOCS_FRAME_ALIGN, docsFrameStyle, docsFrameWidth } from './frame-viewport.ts';
import { createIframeHost, reuseInstance } from './iframe-session.ts';
import type { DocsArticleModel, StoryArgs, StoryInstance } from './page-model.ts';

const storyId = 'button--primary';
const initialGlobals: StoryArgs = { theme: 'light' };
const devices = { options: INITIAL_VIEWPORTS };

function withViewport(globals: StoryArgs, value: string | undefined, isRotated = false) {
  return { ...globals, viewport: { value, isRotated } };
}

function instance(instanceId: string, globals: StoryArgs): StoryInstance {
  return {
    instanceId,
    storyId,
    importSource: './Button.stories',
    exportName: 'Primary',
    focus: false,
    documentOrder: 0,
    position: { line: 1, column: 1 },
    args: { label: 'Hello' },
    argsFromIndex: true,
    globals,
  };
}

function article(globals: StoryArgs): DocsArticleModel {
  return {
    blocks: [],
    instances: [instance('a', structuredClone(globals)), instance('b', structuredClone(globals))],
  };
}

function globalsStore(initial: StoryArgs) {
  let current = structuredClone(initial);
  const snapshot = structuredClone(initial);
  return {
    replace(next: StoryArgs) {
      current = structuredClone(next);
    },
    get() {
      return current;
    },
    resetToInitial() {
      current = structuredClone(snapshot);
    },
  };
}

function argsStore() {
  return {
    replace() {},
    get: () => ({ label: 'Hello' }),
    resetToInitial() {},
  };
}

describe('docs frame viewport', () => {
  it('resolves the width the viewport tool selects and never applies the device height', () => {
    expect(docsFrameWidth({})).toBe('100%');
    expect(docsFrameWidth(withViewport(initialGlobals, undefined))).toBe('100%');
    expect(docsFrameWidth(withViewport(initialGlobals, 'mobile1'))).toBe(
      MINIMAL_VIEWPORTS.mobile1.styles.width
    );
    expect(docsFrameWidth(withViewport(initialGlobals, 'iphonex'), devices)).toBe('375px');
    expect(docsFrameWidth(withViewport(initialGlobals, 'ipad'), devices)).toBe('768px');
    expect(docsFrameWidth({ viewport: 'iphonex' }, devices)).toBe('375px');
    expect(docsFrameWidth(withViewport({}, 'iphonex', true), devices)).toBe('812px');
    expect(docsFrameWidth(withViewport({}, '500-300'))).toBe('500px');

    const phone = docsFrameStyle(docsFrameWidth(withViewport({}, 'iphonex'), devices));
    expect(phone).toEqual({
      width: '375px',
      minWidth: '375px',
      maxWidth: '375px',
      flexShrink: 0,
      alignSelf: 'flex-start',
      display: 'block',
    });
    expect(phone).not.toHaveProperty('height');
    expect(docsFrameStyle('100%').minWidth).toBe('0');
    expect(displayedFrameHeight('100vh', 812, 1040)).toBe(1040);
    expect(displayedFrameHeight(undefined, undefined, 1040)).toBe(COMPACT_FRAME_MIN_HEIGHT);
    expect(storyFrameStyle(undefined, 16 / 9, undefined, 1040)).toEqual({
      height: 'auto',
      aspectRatio: 16 / 9,
    });
    expect(DOCS_FRAME_ALIGN).toEqual({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-start',
    });
  });

  it('changes one instance width and leaves the sibling and the main canvas unchanged', () => {
    const main = structuredClone(initialGlobals);
    const model = article(initialGlobals);
    const phone = withViewport(model.instances[0]!.globals, 'iphonex');
    const sized = withInstanceGlobals(model, 'a', phone);
    const untouchedMain = withInstanceGlobals(sized, MAIN_CANVAS_ID, withViewport(main, 'ipad'));
    const widths = (instances: StoryInstance[]) =>
      instances.map((item) => docsFrameWidth(item.globals, devices));

    expect(widths(sized.instances)).toEqual(['375px', '100%']);
    expect(sized.instances[0]!.globals.theme).toBe('light');
    expect(sized.instances[1]!.globals).toEqual(initialGlobals);
    expect(widths(untouchedMain.instances)).toEqual(['375px', '100%']);
    expect(main).toEqual(initialGlobals);
    expect(phone).not.toBe(model.instances[0]!.globals);

    let host = mountDocsInstances(createIframeHost(), sized.instances);
    host = writeDocsInstanceGlobals(host, 'a', withViewport(initialGlobals, 'ipad'));
    expect(() =>
      writeDocsInstanceGlobals(host, MAIN_CANVAS_ID, withViewport({}, 'iphonex'))
    ).toThrow(/No mounted frame/);

    expect(
      host.sessions.map((session) => docsFrameWidth(session.occupant?.globals ?? {}, devices))
    ).toEqual(['768px', '100%']);
    expect(host.sessions.map((session) => session.occupant?.args)).toEqual([
      { label: 'Hello' },
      { label: 'Hello' },
    ]);
  });

  it('drops the width when globals or the frame reset', () => {
    const instanceGlobals = globalsStore(initialGlobals);
    const siblingGlobals = globalsStore(initialGlobals);
    const doc = createAddressedPreview({
      instanceId: 'a',
      storyId,
      args: argsStore(),
      globals: instanceGlobals,
    });
    expect(
      applyAddressedUpdate(doc, {
        kind: 'globals',
        instanceId: 'a',
        globals: withViewport(initialGlobals, 'ipad'),
      })
    ).toBe(true);
    expect(docsFrameWidth(instanceGlobals.get(), devices)).toBe('768px');
    expect(docsFrameWidth(siblingGlobals.get(), devices)).toBe('100%');

    resetAddressedPreview(doc);
    expect(docsFrameWidth(instanceGlobals.get(), devices)).toBe('100%');
    expect(
      applyAddressedUpdate(doc, {
        kind: 'globals',
        instanceId: 'a',
        globals: withViewport(initialGlobals, 'iphonex'),
      })
    ).toBe(false);
    expect(docsFrameWidth(instanceGlobals.get(), devices)).toBe('100%');

    let host = mountDocsInstances(createIframeHost(), article(initialGlobals).instances);
    host = writeDocsInstanceGlobals(host, 'a', withViewport(initialGlobals, 'iphonex'));
    expect(docsFrameWidth(host.sessions[0]!.occupant!.globals, devices)).toBe('375px');
    host = reuseInstance(host, 'a', {
      instanceId: 'a2',
      storyId,
      args: { label: 'Hello' },
      globals: structuredClone(initialGlobals),
    });
    expect(docsFrameWidth(host.sessions[0]!.occupant!.globals, devices)).toBe('100%');
    expect(releaseDocsFrames(host).sessions.every((session) => session.occupant === null)).toBe(
      true
    );
  });
});
