import { DesignExportError } from 'storybook/internal/server-errors';

import type { Page } from 'playwright';

import type { CapturedStory, ExportStory } from './format.ts';
import type { Resources } from './resources.ts';

type ExportWindow = Window & {
  __storybookExportState: {
    shadowHosts: Element[];
    programmaticFont: boolean;
  };
  __STORYBOOK_ADDONS_CHANNEL__?: {
    last: (event: string) => unknown[] | undefined;
  };
  __STORYBOOK_PREVIEW__?: {
    currentRender?: {
      story?: {
        usesMount?: boolean;
      };
    };
  };
};
type CapturedNode =
  | {
      text: string;
    }
  | {
      tag: string;
      attributes: Record<string, string>;
      styles: [string, string][];
      pseudos: {
        selector: string;
        styles: [string, string][];
      }[];
      children: CapturedNode[];
    };

const escapeHTML = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
  );

export async function captureStory(
  page: Page,
  story: ExportStory,
  base: URL,
  resources: Resources,
  timeout: number
): Promise<CapturedStory> {
  await page.addInitScript(() => {
    const state = { shadowHosts: [] as Element[], programmaticFont: false };
    (window as unknown as ExportWindow).__storybookExportState = state;
    const attachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) {
      state.shadowHosts.push(this);
      return attachShadow.call(this, options);
    };
    window.FontFace = new Proxy(window.FontFace, {
      construct(target, args) {
        state.programmaticFont = true;
        return Reflect.construct(target, args);
      },
    });
  });
  const url = new URL('iframe.html', base);
  url.searchParams.set('id', story.id);
  url.searchParams.set('viewMode', 'story');
  url.searchParams.set('embed', 'true');
  const errors: string[] = [];
  const onError = (error: Error) => {
    errors.push(error.message);
  };
  page.on('pageerror', onError);
  try {
    const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout });
    if (!response?.ok()) {
      throw new DesignExportError({
        message: `Story preview returned HTTP ${response?.status() ?? 'unknown'}`,
      });
    }
    await page.waitForFunction(
      (id) => {
        const target = window as unknown as ExportWindow;
        const channel = target.__STORYBOOK_ADDONS_CHANNEL__;
        for (const event of ['storyErrored', 'storyThrewException', 'storyMissing']) {
          if (channel?.last(event)) {
            throw new DOMException(
              `Storybook reported ${event}. Open this story in Storybook to fix it.`
            );
          }
        }
        if (target.__STORYBOOK_PREVIEW__?.currentRender?.story?.usesMount) {
          throw new DOMException(
            'This story mounts in play(). Provide an initial render that does not require play().'
          );
        }
        return channel?.last('storyRendered')?.[0] === id;
      },
      story.id,
      { timeout }
    );
    const snapshot = await page.evaluate(async () => {
      const state = (window as unknown as ExportWindow).__storybookExportState;
      if (state.shadowHosts.some((element) => element.isConnected)) {
        throw new DOMException(
          'Shadow DOM cannot be exported as editable HTML. Use a light DOM story.'
        );
      }
      if (state.programmaticFont) {
        throw new DOMException(
          'Programmatic FontFace fonts are unsupported. Declare fonts with CSS @font-face.'
        );
      }
      for (const image of document.images) {
        if (image.currentSrc || image.getAttribute('src')) {
          image.loading = 'eager';
          await image.decode();
        }
      }
      await document.fonts.ready;
      for (const animation of document.getAnimations()) {
        animation.pause();
      }
      const properties = (style: CSSStyleDeclaration): [string, string][] =>
        Array.from(style)
          .filter((name) => !name.startsWith('--'))
          .map((name) => [name, style.getPropertyValue(name)]);
      let serial = 0;
      const visit = (node: Node): CapturedNode | undefined => {
        if (node.nodeType === Node.TEXT_NODE) {
          return { text: node.textContent ?? '' };
        }
        if (!(node instanceof Element)) {
          return undefined;
        }
        const tag = node.localName;
        if (
          ['script', 'style', 'link', 'base', 'meta', 'template', 'noscript', 'source'].includes(
            tag
          )
        ) {
          return undefined;
        }
        if (
          [
            'canvas',
            'video',
            'audio',
            'iframe',
            'object',
            'embed',
            'animate',
            'animateTransform',
            'set',
          ].includes(tag)
        ) {
          throw new DOMException(
            `Unsupported <${tag}> content. Provide an editable DOM equivalent for export.`
          );
        }
        if (node.shadowRoot) {
          throw new DOMException('Shadow DOM cannot be exported as editable HTML.');
        }
        const attributes: Record<string, string> = {};
        for (const attribute of node.attributes) {
          const name = attribute.name;
          if (
            !/^on/i.test(name) &&
            ![
              'style',
              'src',
              'srcset',
              'href',
              'xlink:href',
              'action',
              'formaction',
              'ping',
              'srcdoc',
              'is',
              'autofocus',
            ].includes(name)
          ) {
            attributes[name] = attribute.value;
          }
        }
        if (node instanceof HTMLImageElement) {
          if (node.currentSrc) {
            attributes.src = node.currentSrc;
          }
        } else if (node.hasAttribute('src')) {
          attributes.src = new URL(node.getAttribute('src')!, node.baseURI).href;
        }
        if (node.namespaceURI === 'http://www.w3.org/2000/svg') {
          const href = node.getAttribute('href') ?? node.getAttribute('xlink:href');
          if (href) {
            if (tag === 'use' && !href.startsWith('#')) {
              throw new DOMException(
                'External SVG use references are unsupported. Inline the SVG symbol.'
              );
            }
            attributes.href = href.startsWith('#') ? href : new URL(href, node.baseURI).href;
          }
        }
        if (node instanceof HTMLInputElement) {
          if (node.type === 'file' || node.type === 'password') {
            attributes.value = '';
          } else {
            attributes.value = node.value;
          }
          delete attributes.checked;
          if (node.checked) {
            attributes.checked = '';
          }
        }
        if (node instanceof HTMLOptionElement) {
          delete attributes.selected;
          if (node.selected) {
            attributes.selected = '';
          }
        }
        const id = `n${++serial}`;
        attributes['data-storybook-export'] = id;
        const pseudos = ['::before', '::after', '::marker'].flatMap((pseudo) => {
          const style = getComputedStyle(node, pseudo);
          return !['none', 'normal', ''].includes(style.content)
            ? [{ selector: `[data-storybook-export="${id}"]${pseudo}`, styles: properties(style) }]
            : [];
        });
        const children =
          node instanceof HTMLTextAreaElement
            ? [{ text: node.value }]
            : Array.from(node.childNodes).flatMap((child) => {
                const value = visit(child);
                return value ? [value] : [];
              });
        return {
          tag: tag === 'body' ? 'div' : tag,
          attributes,
          styles: properties(getComputedStyle(node)),
          pseudos,
          children,
        };
      };
      const sheets = [...Array.from(document.styleSheets), ...document.adoptedStyleSheets]
        .filter(
          (sheet) =>
            !sheet.disabled && (!sheet.media.mediaText || matchMedia(sheet.media.mediaText).matches)
        )
        .map((sheet) => {
          try {
            return {
              text: Array.from(sheet.cssRules)
                .map((rule) => rule.cssText)
                .join('\n'),
              url: sheet.href ?? document.baseURI,
            };
          } catch {
            if (!sheet.href) {
              throw new DOMException('Cannot read an adopted stylesheet.');
            }
            return { text: null, url: sheet.href };
          }
        });
      const rootStyle = getComputedStyle(document.documentElement);
      const background =
        rootStyle.backgroundColor === 'rgba(0, 0, 0, 0)' && rootStyle.backgroundImage === 'none'
          ? getComputedStyle(document.body)
          : rootStyle;
      return {
        node: visit(document.body)!,
        background: properties(background).filter(([name]) => name.startsWith('background-')),
        sheets,
        base: document.baseURI,
        width: Math.max(innerWidth, document.documentElement.scrollWidth),
        height: Math.max(innerHeight, document.documentElement.scrollHeight),
        lang: document.documentElement.lang,
      };
    });
    if (errors.length) {
      throw new DesignExportError({ message: `Preview JavaScript failed: ${errors[0]}` });
    }
    let stylesheet = '';
    for (const sheet of snapshot.sheets) {
      let text = sheet.text;
      if (text === null) {
        const response = await page.request.get(sheet.url, { timeout });
        try {
          if (!response.ok()) {
            throw new DesignExportError({
              message: `Stylesheet returned HTTP ${response.status()}`,
            });
          }
          text = await response.text();
          sheet.url = response.url();
        } finally {
          await response.dispose();
        }
      }
      stylesheet += await resources.fonts(text, sheet.url, (kind, condition) =>
        page.evaluate(
          ({ kind, condition }) =>
            kind === 'media' ? matchMedia(condition).matches : CSS.supports(condition),
          { kind, condition }
        )
      );
    }
    const styleText = async (styles: [string, string][]) => {
      const declarations = [];
      for (const [name, value] of styles) {
        declarations.push(`${name}:${await resources.css(value, snapshot.base)};`);
      }
      return declarations.join('') + 'animation:none!important;transition:none!important;';
    };
    const serialize = async (node: CapturedNode): Promise<string> => {
      if ('text' in node) {
        return escapeHTML(node.text);
      }
      node.attributes.style = await styleText(node.styles);
      for (const attribute of ['src', 'href']) {
        if (node.attributes[attribute]) {
          node.attributes[attribute] = await resources.asset(
            node.attributes[attribute],
            snapshot.base
          );
        }
      }
      for (const pseudo of node.pseudos) {
        stylesheet += `${pseudo.selector}{${await styleText(pseudo.styles)}}`;
      }
      const attributes = Object.entries(node.attributes)
        .map(([name, value]) => ` ${name}="${escapeHTML(value)}"`)
        .join('');
      const opening = `<${node.tag}${attributes}>`;
      if (['area', 'br', 'col', 'hr', 'img', 'input', 'param', 'track', 'wbr'].includes(node.tag)) {
        return opening;
      }
      const children = [];
      for (const child of node.children) {
        children.push(await serialize(child));
      }
      return `${opening}${children.join('')}</${node.tag}>`;
    };
    const content = await serialize(snapshot.node);
    stylesheet += `html{${await styleText(snapshot.background)}}`;
    const html = `<!doctype html><html lang="${escapeHTML(snapshot.lang)}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; font-src 'self' data:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"><style>html,body{margin:0;padding:0}x-dc{display:block;position:relative}${stylesheet.replace(/</g, '\\3c ')}</style></head><body><x-dc>${content}</x-dc></body></html>`;
    return { ...story, html, width: snapshot.width, height: snapshot.height };
  } finally {
    page.off('pageerror', onError);
  }
}
