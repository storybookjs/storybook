import { logger } from 'storybook/internal/client-logger';
import type { PreparedStory } from 'storybook/internal/types';

import { global } from '@storybook/global';

import AnsiToHtml from 'ansi-to-html';
import { parse } from 'picoquery';
import { dedent } from 'ts-dedent';

import type { View } from './View.ts';
import { createBlock } from './blocks.ts';

const { document } = global;

const PREPARING_DELAY = 100;

enum Mode {
  MAIN = 'main',
  NOPREVIEW = 'nopreview',
  PREPARING_STORY = 'preparing-story',
  PREPARING_DOCS = 'preparing-docs',
  ERROR = 'error',
}
// The mode as classes on <body>, for addons and Chromatic, which read them there. The view never
// does, and a story that owns the document gets none.
const classes: Record<Mode, string> = {
  [Mode.PREPARING_STORY]: 'sb-show-preparing-story',
  [Mode.PREPARING_DOCS]: 'sb-show-preparing-docs',
  [Mode.MAIN]: 'sb-show-main',
  [Mode.NOPREVIEW]: 'sb-show-nopreview',
  [Mode.ERROR]: 'sb-show-errordisplay',
};

type BlockMode = Exclude<Mode, Mode.MAIN>;

const layoutClassMap = {
  centered: 'sb-main-centered',
  fullscreen: 'sb-main-fullscreen',
  padded: 'sb-main-padded',
} as const;
type Layout = keyof typeof layoutClassMap | 'none' | 'document';

const ansiConverter = new AnsiToHtml({
  escapeXML: true,
});

const createRoot = (id: string) => {
  const root = document.createElement('div');
  root.id = id;
  return root;
};

// A story may replace the body, which takes our elements out of the document with it.
const attach = (element: HTMLElement) => {
  if (!element.isConnected) {
    document.body.append(element);
  }
  return element;
};

// Storybook's own UI: a child of <html> after <body>, in the top layer while it shows a block and out
// of the document otherwise, so a story that replaces, clears or covers the body takes nothing of it
// away.
const createHost = () => {
  const host = document.createElement('sb-preview');
  host.setAttribute('popover', 'manual');
  return host;
};

export class WebView implements View<HTMLElement> {
  private layout: Layout = 'padded';

  private testing = false;

  private preparingTimeout?: ReturnType<typeof setTimeout>;

  private storyRootElement?: HTMLElement;

  private docsRootElement?: HTMLElement;

  private hostElement?: HTMLElement;

  // Only the block of the current mode is in the host.
  private blocks = new Map<BlockMode, HTMLElement>();

  constructor() {
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
  prepareForStory(
    story: PreparedStory<any>,
    { scrollReset = true }: { scrollReset?: boolean } = {}
  ) {
    this.applyLayout(story.parameters.layout);

    // Only reset scroll when navigating to a new story or switching view modes, not on HMR
    // re-renders. Without this guard, hot-reloading a story file while scrolled down on a
    // tall story causes the page to jump back to the top.
    if (scrollReset) {
      document.documentElement.scrollTop = 0;
      document.documentElement.scrollLeft = 0;
    }

    if (this.layout === 'document') {
      // The story's render will own the body, so Storybook takes its classes and its roots back from
      // it. Until the render leaves a body of its own, the story's root is this one.
      document.body.classList.remove(...Object.values(classes));
      this.detachRoots();
      return document.body;
    }

    this.showStory();
    const storyRoot = this.storyRoot();
    this.applyHtmlLang(storyRoot, story.parameters.htmlLang);

    return storyRoot;
  }

  storyRoot(): HTMLElement {
    this.storyRootElement ??=
      document.getElementById('storybook-root') ?? createRoot('storybook-root');
    return attach(this.storyRootElement);
  }

  prepareForDocs({ scrollReset = true }: { scrollReset?: boolean } = {}) {
    this.showMain();
    this.showDocs();
    this.applyLayout('fullscreen');

    // Only reset scroll when navigating to a new docs page, not on HMR re-renders.
    // Without this guard, hot-reloading a story file while scrolled down on a docs page
    // causes the page to jump back to the top.

    if (scrollReset) {
      document.documentElement.scrollTop = 0;
      document.documentElement.scrollLeft = 0;
    }

    return this.docsRoot();
  }

  docsRoot(): HTMLElement {
    this.docsRootElement ??=
      document.getElementById('storybook-docs') ?? createRoot('storybook-docs');
    return attach(this.docsRootElement);
  }

  // Storybook's roots leave a body that a story owns; the next story or docs page attaches them again.
  private detachRoots() {
    this.storyRootElement ??= document.getElementById('storybook-root') ?? undefined;
    this.docsRootElement ??= document.getElementById('storybook-docs') ?? undefined;
    this.storyRootElement?.remove();
    this.docsRootElement?.remove();
  }

  private block(mode: BlockMode) {
    if (!this.blocks.has(mode)) {
      this.blocks.set(mode, createBlock(mode));
    }
    return this.blocks.get(mode)!;
  }

  scrollToAnchor(hash: string) {
    // getElementById instead of querySelector: anchor ids (e.g. story ids) may contain
    // characters that are invalid in CSS selectors.
    const element = document.getElementById(decodeURIComponent(hash.substring(1)));
    element?.scrollIntoView({ behavior: 'smooth' });
  }

  applyLayout(layout: Layout = 'padded') {
    this.layout = layout;
    document.body.classList.remove(...Object.values(layoutClassMap));
    if (layout === 'none' || layout === 'document') {
      return;
    }

    this.checkIfLayoutExists(layout);
    document.body.classList.add(layoutClassMap[layout]);
  }

  /**
   * Injects a BCP-47 lang attribute to the story root, or removes it if `lang` is null.
   */
  applyHtmlLang(element: HTMLElement, lang?: string) {
    if (lang) {
      element.setAttribute('lang', lang);
    } else {
      element.removeAttribute('lang');
    }
  }

  checkIfLayoutExists(layout: keyof typeof layoutClassMap) {
    if (!layoutClassMap[layout]) {
      logger.warn(
        dedent`
          The desired layout: ${layout} is not a valid option.
          The possible options are: ${Object.keys(layoutClassMap).join(', ')}, none, document.
        `
      );
    }
  }

  showMode(mode: Mode) {
    clearTimeout(this.preparingTimeout);
    if (this.layout !== 'document') {
      Object.values(Mode).forEach((otherMode) => {
        document.body.classList.toggle(classes[otherMode], otherMode === mode);
      });
    }
    if (mode === Mode.MAIN) {
      this.hideHost();
    } else {
      this.showHost(mode);
    }
  }

  private showHost(mode: BlockMode) {
    this.hostElement ??= createHost();
    const host = this.hostElement;
    // A render that clears <html> removes the host, which also closes it.
    if (!host.isConnected) {
      document.documentElement.append(host);
    }
    host.dataset.mode = mode;
    const block = this.block(mode);
    // The block that is shown stays in place, so its spinner does not start over.
    if (host.firstElementChild !== block) {
      host.replaceChildren(block);
    }
    if (!host.matches(':popover-open')) {
      host.showPopover();
    }
  }

  // Leaving the document also closes it.
  private hideHost() {
    this.hostElement?.remove();
  }

  showErrorDisplay({ message = '', stack = '' }) {
    let header = message;
    let detail = stack;
    const parts = message.split('\n');
    if (parts.length > 1) {
      [header] = parts;
      detail = parts.slice(1).join('\n').replace(/^\n/, '');
    }

    const errorDisplay = this.block(Mode.ERROR);
    errorDisplay.querySelector('#error-message')!.innerHTML = ansiConverter.toHtml(header);
    errorDisplay.querySelector('#error-stack')!.innerHTML = ansiConverter.toHtml(detail);

    this.showMode(Mode.ERROR);
  }

  showNoPreview() {
    if (this.testing) {
      return;
    }

    this.showMode(Mode.NOPREVIEW);

    this.storyRoot().setAttribute('hidden', 'true');
    this.docsRoot().setAttribute('hidden', 'true');
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
}
