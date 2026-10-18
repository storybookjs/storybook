import { logger } from 'storybook/internal/client-logger';
import type { PreparedStory } from 'storybook/internal/types';

import { global } from '@storybook/global';

import AnsiToHtml from 'ansi-to-html';
import { parse } from 'picoquery';
import { dedent } from 'ts-dedent';

import type { View } from './View.ts';

const { document } = global;

const PREPARING_DELAY = 100;

enum Mode {
  MAIN = 'MAIN',
  NOPREVIEW = 'NOPREVIEW',
  PREPARING_STORY = 'PREPARING_STORY',
  PREPARING_DOCS = 'PREPARING_DOCS',
  ERROR = 'ERROR',
}
// Addons, Chromatic and the preview's CSS read these from <body>.
const classes: Record<Mode, string> = {
  PREPARING_STORY: 'sb-show-preparing-story',
  PREPARING_DOCS: 'sb-show-preparing-docs',
  MAIN: 'sb-show-main',
  NOPREVIEW: 'sb-show-nopreview',
  ERROR: 'sb-show-errordisplay',
};

type BlockMode = Exclude<Mode, Mode.MAIN>;

// Storybook's own blocks; only the one of the current mode is in the document.
const blockHtml: Record<BlockMode, string> = {
  PREPARING_STORY: `
    <div class="sb-preparing-story sb-wrapper">
      <div class="sb-loader"></div>
    </div>
  `,
  PREPARING_DOCS: `
    <div class="sb-preparing-docs sb-wrapper">
      <div class="sb-previewBlock">
        <div class="sb-previewBlock_header">
          <div class="sb-previewBlock_icon"></div>
          <div class="sb-previewBlock_icon"></div>
          <div class="sb-previewBlock_icon"></div>
          <div class="sb-previewBlock_icon"></div>
        </div>
        <div class="sb-previewBlock_body">
          <div class="sb-loader"></div>
        </div>
      </div>
      <table aria-hidden="true" class="sb-argstableBlock">
        <thead class="sb-argstableBlock-head">
          <tr>
            <th><span>Name</span></th>
            <th><span>Description</span></th>
            <th><span>Default</span></th>
            <th><span>Control </span></th>
          </tr>
        </thead>
        <tbody class="sb-argstableBlock-body">
          <tr>
            <td><span>propertyName</span><span title="Required">*</span></td>
            <td>
              <div><span>This is a short description</span></div>
              <div class="sb-argstableBlock-summary">
                <div><span class="sb-argstableBlock-code">summary</span></div>
              </div>
            </td>
            <td>
              <div><span class="sb-argstableBlock-code">defaultValue</span></div>
            </td>
            <td><button>Set string</button></td>
          </tr>
          <tr>
            <td><span>propertyName</span><span>*</span></td>
            <td>
              <div><span>This is a short description</span></div>
              <div class="sb-argstableBlock-summary">
                <div><span class="sb-argstableBlock-code">summary</span></div>
              </div>
            </td>
            <td>
              <div><span class="sb-argstableBlock-code">defaultValue</span></div>
            </td>
            <td><button>Set string</button></td>
          </tr>
          <tr>
            <td><span>propertyName</span><span>*</span></td>
            <td>
              <div><span>This is a short description</span></div>
              <div class="sb-argstableBlock-summary">
                <div><span class="sb-argstableBlock-code">summary</span></div>
              </div>
            </td>
            <td>
              <div><span class="sb-argstableBlock-code">defaultValue</span></div>
            </td>
            <td><button>Set string</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  NOPREVIEW: `
    <div class="sb-nopreview sb-wrapper">
      <div class="sb-nopreview_main">
        <h1 class="sb-nopreview_heading sb-heading">No Preview</h1>
        <p>Sorry, but you either have no stories or none are selected somehow.</p>
        <ul>
          <li>Please check the Storybook config.</li>
          <li>Try reloading the page.</li>
        </ul>
        <p>
          If the problem persists, check the browser console, or the terminal you've run Storybook from.
        </p>
      </div>
    </div>
  `,
  ERROR: `
    <div class="sb-errordisplay sb-wrapper">
      <div class="sb-errordisplay_main">
        <h1 id="error-message"></h1>
        <p>
          The component failed to render properly, likely due to a configuration issue in Storybook.
          Here are some common causes and how you can address them:
        </p>
        <ol>
          <li>
            <strong>Missing Context/Providers</strong>: You can use decorators to supply specific
            contexts or providers, which are sometimes necessary for components to render correctly. For
            detailed instructions on using decorators, please visit the
            <a href="https://storybook.js.org/docs/writing-stories/decorators"
              >Decorators documentation</a
            >.
          </li>
          <li>
            <strong>Misconfigured Webpack or Vite</strong>: Verify that Storybook picks up all necessary
            settings for loaders, plugins, and other relevant parameters. You can find step-by-step
            guides for configuring
            <a href="https://storybook.js.org/docs/builders/webpack">Webpack</a> or
            <a href="https://storybook.js.org/docs/builders/vite">Vite</a>
            with Storybook.
          </li>
          <li>
            <strong>Missing Environment Variables</strong>: Your Storybook may require specific
            environment variables to function as intended. You can set up custom environment variables
            as outlined in the
            <a href="https://storybook.js.org/docs/configure/environment-variables"
              >Environment Variables documentation</a
            >.
          </li>
        </ol>
        <pre class="sb-errordisplay_code"><code id="error-stack"></code></pre>
      </div>
    </div>
  `,
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

export const createBlock = (mode: BlockMode) => {
  const template = document.createElement('template');
  template.innerHTML = blockHtml[mode].trim();
  return template.content.firstElementChild as HTMLElement;
};

const createRoot = (id: string) => {
  const root = document.createElement('div');
  root.id = id;
  return root;
};

// A story may replace the body, which takes our elements out of the document with it.
const attach = (element: HTMLElement, position: 'prepend' | 'append' = 'append') => {
  if (!element.isConnected) {
    document.body[position](element);
  }
  return element;
};

export class WebView implements View<HTMLElement> {
  private currentLayoutClass?: (typeof layoutClassMap)[keyof typeof layoutClassMap] | null;

  private testing = false;

  private preparingTimeout?: ReturnType<typeof setTimeout>;

  private storyRootElement?: HTMLElement;

  private docsRootElement?: HTMLElement;

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
    this.showStory();
    this.applyLayout(story.parameters.layout);

    // Only reset scroll when navigating to a new story or switching view modes, not on HMR
    // re-renders. Without this guard, hot-reloading a story file while scrolled down on a
    // tall story causes the page to jump back to the top.
    if (scrollReset) {
      document.documentElement.scrollTop = 0;
      document.documentElement.scrollLeft = 0;
    }

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
    this.blocks.forEach((element, blockMode) => {
      if (blockMode !== mode) {
        element.remove();
      }
    });
    if (mode !== Mode.MAIN) {
      attach(this.block(mode), 'prepend');
    }
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

  showStoryDuringRender() {
    // When 'showStory' is called (at the start of rendering) we get rid of our display:none
    // from all children of the root (but keep the preparing spinner visible). This may mean
    // that very weird and high z-index stories are briefly visible.
    // See https://github.com/storybookjs/storybook/issues/16847 and
    //   http://localhost:9011/?path=/story/core-rendering--auto-focus (official SB)
    document.body.classList.add(classes.MAIN);
  }
}
