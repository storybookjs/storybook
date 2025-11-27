import { logger } from 'storybook/internal/client-logger';
import type { PreparedStory } from 'storybook/internal/types';

import { global } from '@storybook/global';

import AnsiToHtml from 'ansi-to-html';
import { parse } from 'picoquery';
import { dedent } from 'ts-dedent';

import type { View } from './View';

const { document } = global;

const PREPARING_DELAY = 100;

enum Mode {
  'MAIN' = 'MAIN',
  'NOPREVIEW' = 'NOPREVIEW',
  'PREPARING_STORY' = 'PREPARING_STORY',
  'PREPARING_DOCS' = 'PREPARING_DOCS',
  'ERROR' = 'ERROR',
}
const classes: Record<Mode, string> = {
  PREPARING_STORY: 'sb-show-preparing-story',
  PREPARING_DOCS: 'sb-show-preparing-docs',
  MAIN: 'sb-show-main',
  NOPREVIEW: 'sb-show-nopreview',
  ERROR: 'sb-show-errordisplay',
};

const layoutClassMap = {
  centered: 'sb-main-centered',
  fullscreen: 'sb-main-fullscreen',
  padded: 'sb-main-padded',
} as const;
type Layout = keyof typeof layoutClassMap | 'none';

const ansiConverter = new AnsiToHtml({
  escapeXML: true,
});

export class WebView implements View<HTMLElement> {
  private currentLayoutClass?: (typeof layoutClassMap)[keyof typeof layoutClassMap] | null;

  private testing = false;

  private preparingTimeout?: ReturnType<typeof setTimeout>;

  /**
   * Fix for issue #33112: Prevent decorator mutations from bleeding into Docs
   *
   * Some decorators mutate document.documentElement (e.g., setting dir, lang, data-theme) to apply
   * global styles for stories. Without cleanup, these mutations persist when navigating from Canvas
   * to Docs, causing visual corruption.
   *
   * Solution: Snapshot documentElement attributes before rendering a story, then restore the
   * original state when switching to Docs view. This ensures decorators can freely mutate the
   * document for Canvas rendering without affecting Docs pages.
   *
   * Tracked attributes: dir, lang, class, data-theme, style
   */
  private documentElementSnapshot: Map<string, string | null> = new Map();

  constructor() {
    // Snapshot the initial clean state of documentElement before any stories render
    // This gives us a baseline to restore to when switching to Docs mode
    this.snapshotDocumentElement();

    // Special code for testing situations
    if (typeof document !== 'undefined') {
      const { __SPECIAL_TEST_PARAMETER__ } = parse(document.location.search.slice(1));
      switch (__SPECIAL_TEST_PARAMETER__) {
        case 'preparing-story': {
          this.showPreparingStory();
          this.testing = true;
          break;
        }
        case 'preparing-docs': {
          this.showPreparingDocs();
          this.testing = true;
          break;
        }
        default: // pass;
      }
    }
  }

  // Get ready to render a story, returning the element to render to
  prepareForStory(story: PreparedStory<any>) {
    this.showStory();
    this.applyLayout(story.parameters.layout);

    document.documentElement.scrollTop = 0;
    document.documentElement.scrollLeft = 0;

    // Don't snapshot here - decorators haven't run yet and might mutate after this point

    return this.storyRoot();
  }

  storyRoot(): HTMLElement {
    return document.getElementById('storybook-root')!;
  }

  prepareForDocs() {
    this.showMain();
    this.showDocs();
    this.applyLayout('fullscreen');

    document.documentElement.scrollTop = 0;
    document.documentElement.scrollLeft = 0;

    // Restore documentElement to initial clean state (captured in constructor)
    // This cleans up any modifications made by story decorators (fixes issue #33112)
    this.restoreDocumentElement();

    return this.docsRoot();
  }

  docsRoot(): HTMLElement {
    return document.getElementById('storybook-docs')!;
  }

  applyLayout(layout: Layout = 'padded') {
    if (layout === 'none') {
      document.body.classList.remove(this.currentLayoutClass!);
      this.currentLayoutClass = null;
      return;
    }

    this.checkIfLayoutExists(layout);

    const layoutClass = layoutClassMap[layout];

    document.body.classList.remove(this.currentLayoutClass!);
    document.body.classList.add(layoutClass);
    this.currentLayoutClass = layoutClass;
  }

  checkIfLayoutExists(layout: keyof typeof layoutClassMap) {
    if (!layoutClassMap[layout]) {
      logger.warn(
        dedent`
          The desired layout: ${layout} is not a valid option.
          The possible options are: ${Object.keys(layoutClassMap).join(', ')}, none.
        `
      );
    }
  }

  showMode(mode: Mode) {
    clearTimeout(this.preparingTimeout);
    Object.keys(Mode).forEach((otherMode) => {
      if (otherMode === mode) {
        document.body.classList.add(classes[otherMode]);
      } else {
        document.body.classList.remove(classes[otherMode as Mode]);
      }
    });
  }

  showErrorDisplay({ message = '', stack = '' }) {
    let header = message;
    let detail = stack;
    const parts = message.split('\n');
    if (parts.length > 1) {
      [header] = parts;
      detail = parts.slice(1).join('\n').replace(/^\n/, '');
    }

    document.getElementById('error-message')!.innerHTML = ansiConverter.toHtml(header);
    document.getElementById('error-stack')!.innerHTML = ansiConverter.toHtml(detail);

    this.showMode(Mode.ERROR);
  }

  showNoPreview() {
    if (this.testing) {
      return;
    }

    this.showMode(Mode.NOPREVIEW);

    // In storyshots this can get called and these two can be null
    this.storyRoot()?.setAttribute('hidden', 'true');
    this.docsRoot()?.setAttribute('hidden', 'true');
  }

  showPreparingStory({ immediate = false } = {}) {
    clearTimeout(this.preparingTimeout);

    if (immediate) {
      this.showMode(Mode.PREPARING_STORY);
    } else {
      this.preparingTimeout = setTimeout(
        () => this.showMode(Mode.PREPARING_STORY),
        PREPARING_DELAY
      );
    }
  }

  showPreparingDocs({ immediate = false } = {}) {
    clearTimeout(this.preparingTimeout);
    if (immediate) {
      this.showMode(Mode.PREPARING_DOCS);
    } else {
      this.preparingTimeout = setTimeout(() => this.showMode(Mode.PREPARING_DOCS), PREPARING_DELAY);
    }
  }

  showMain() {
    this.showMode(Mode.MAIN);
  }

  showDocs() {
    this.storyRoot().setAttribute('hidden', 'true');
    this.docsRoot().removeAttribute('hidden');
  }

  showStory() {
    this.docsRoot().setAttribute('hidden', 'true');
    this.storyRoot().removeAttribute('hidden');
  }

  showStoryDuringRender() {
    // When 'showStory' is called (at the start of rendering) we get rid of our display:none
    // from all children of the root (but keep the preparing spinner visible). This may mean
    // that very weird and high z-index stories are briefly visible.
    // See https://github.com/storybookjs/storybook/issues/16847 and
    //   http://localhost:9011/?path=/story/core-rendering--auto-focus (official SB)
    document.body.classList.add(classes.MAIN);
  }

  /**
   * Snapshot the current state of document.documentElement attributes. Called when preparing to
   * render rendering a story so we can detect what decorators modify.
   */
  private snapshotDocumentElement() {
    // Safety check: Exit if not in a browser environment (SSR, Node.js tests, etc.)
    if (typeof document === 'undefined') {
      return;
    }

    this.documentElementSnapshot.clear();

    const documentElement = document.documentElement;
    if (documentElement) {
      // Capture commonly modified attributes that decorators might change
      const attributesToTrack = ['dir', 'lang', 'class', 'data-theme', 'style'];
      attributesToTrack.forEach((attr) => {
        this.documentElementSnapshot.set(attr, documentElement.getAttribute(attr));
      });
    }
  }

  /**
   * Restore document.documentElement to its state before the story was rendered. This cleans up any
   * modifications made by decorators to prevent bleed into Docs mode. Fixes issue #33112:
   * https://github.com/storybookjs/storybook/issues/33112
   */
  private restoreDocumentElement() {
    // Safety check: Exit if not in a browser environment
    if (typeof document === 'undefined') {
      return;
    }

    const documentElement = document.documentElement;
    if (documentElement && this.documentElementSnapshot.size > 0) {
      this.documentElementSnapshot.forEach((originalValue, attr) => {
        const currentValue = documentElement.getAttribute(attr);

        // Only restore if the value changed (decorator modified it)
        if (currentValue !== originalValue) {
          if (originalValue === null) {
            documentElement.removeAttribute(attr);
          } else {
            documentElement.setAttribute(attr, originalValue);
          }
        }
      });
    }
  }
}
