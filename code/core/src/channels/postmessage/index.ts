/// <reference path="../../typings.d.ts" />
import { global } from '@storybook/global';

import { logger, pretty } from '@storybook/core/client-logger';
import * as EVENTS from '@storybook/core/core-events';

import { isJSON, parse, stringify } from 'telejson';
import invariant from 'tiny-invariant';

import { InvalidChannelPageError } from '../../preview-errors';
import { LOOPBACK_HOSTNAMES, matchesHostname } from '../../shared/utils/local-hosts';
import type {
  BufferedEvent,
  ChannelEvent,
  ChannelHandler,
  ChannelTransport,
  Config,
} from '../types';
import { getEventSourceUrl } from './getEventSourceUrl';

const { document, location } = global;

export const KEY = 'storybook-channel';

const defaultEventOptions = { allowFunction: false, maxDepth: 25 };

interface FrameTarget {
  contentWindow: Window;
  targetOrigin: string;
}

const getReferrerOrigin = (): string | null => {
  try {
    const origin = document?.referrer && new URL(document.referrer).origin;
    return origin && origin !== 'null' ? origin : null;
  } catch {
    return null;
  }
};

// A frame still on its initial about:blank document has no listener yet. It also shares our origin,
// so the browser rejects a message addressed to the preview's origin and logs an error.
const isOnInitialBlankDocument = (frame: Window): boolean => {
  try {
    return frame.location.href === 'about:blank';
  } catch {
    return false;
  }
};

// Only a dev-mode preview is wired to a dev server on the developer's machine, so only there is the
// embedding manager's origin restricted. A built preview is static and may be composed by any host,
// and a page served from an opaque origin (e.g. file://) has no origin to check against.
const getOriginValidator = (): ((origin: string) => boolean) | null => {
  const own = location?.origin;
  if (global.CONFIG_TYPE !== 'DEVELOPMENT' || !own || own === 'null') {
    return null;
  }
  return (origin) => {
    if (origin === own) {
      return true;
    }
    try {
      return matchesHostname(new URL(origin).hostname, LOOPBACK_HOSTNAMES);
    } catch {
      return false;
    }
  };
};

// TODO: we should export a method for opening child windows here and keep track of em.
// that way we can send postMessage to child windows as well, not just iframe
// https://stackoverflow.com/questions/6340160/how-to-get-the-references-of-all-already-opened-child-windows

export class PostMessageTransport implements ChannelTransport {
  private buffer: BufferedEvent[];

  private handler?: ChannelHandler;

  private connected = false;

  private readonly originValidator: ((origin: string) => boolean) | null;

  private readonly insecureIframeMessaging: boolean;

  private readonly pinsTargetOrigin: boolean;

  private readonly rejectedOrigins = new Set<string>();

  constructor(private readonly config: Config) {
    this.buffer = [];
    this.originValidator = getOriginValidator();
    this.insecureIframeMessaging = global.INSECURE_IFRAME_MESSAGING === true;
    // A built Storybook addresses its messages to any origin, so a ref whose URL redirects to
    // another origin keeps receiving them.
    this.pinsTargetOrigin = global.CONFIG_TYPE === 'DEVELOPMENT' && !this.insecureIframeMessaging;

    if (typeof global?.addEventListener === 'function') {
      global.addEventListener('message', this.handleEvent.bind(this), false);
    }

    // Check whether the config.page parameter has a valid value
    if (config.page !== 'manager' && config.page !== 'preview') {
      throw new InvalidChannelPageError({ page: config.page });
    }
  }

  setHandler(handler: ChannelHandler): void {
    this.handler = (...args) => {
      handler.apply(this, args);

      if (!this.connected && this.getLocalFrame().length) {
        this.flush();
        this.connected = true;
      }
    };
  }

  /**
   * Sends `event` to the associated window. If the window does not yet exist the event will be
   * stored in a buffer and sent when the window exists.
   *
   * @param event
   */
  send(event: ChannelEvent, options?: any): Promise<any> {
    const {
      target,

      // telejson options
      allowRegExp,
      allowFunction,
      allowSymbol,
      allowDate,
      allowError,
      allowUndefined,
      allowClass,
      maxDepth,
      space,
      lazyEval,
    } = options || {};

    const eventOptions = Object.fromEntries(
      Object.entries({
        allowRegExp,
        allowFunction,
        allowSymbol,
        allowDate,
        allowError,
        allowUndefined,
        allowClass,
        maxDepth,
        space,
        lazyEval,
      }).filter(([k, v]) => typeof v !== 'undefined')
    );

    const stringifyOptions = {
      ...defaultEventOptions,
      ...(global.CHANNEL_OPTIONS || {}),
      ...eventOptions,
    };

    const frames = this.getFrames(target);

    const query = new URLSearchParams(location?.search || '');

    const data = stringify(
      {
        key: KEY,
        event,
        refId: query.get('refId'),
      },
      stringifyOptions
    );

    if (!frames.length) {
      return new Promise((resolve, reject) => {
        this.buffer.push({ event, resolve, reject });
      });
    }
    if (this.buffer.length) {
      this.flush();
    }

    frames.forEach(({ contentWindow, targetOrigin }) => {
      if (this.config.page === 'manager' && isOnInitialBlankDocument(contentWindow)) {
        return;
      }
      try {
        contentWindow.postMessage(data, this.pinsTargetOrigin ? targetOrigin : '*');
      } catch (e) {
        logger.error('sending over postmessage fail');
      }
    });

    return Promise.resolve(null);
  }

  private flush(): void {
    const { buffer } = this;
    this.buffer = [];
    buffer.forEach((item) => {
      this.send(item.event).then(item.resolve).catch(item.reject);
    });
  }

  private getFrames(target?: string): FrameTarget[] {
    // Manager implementation.
    if (this.config.page === 'manager') {
      const nodes: HTMLIFrameElement[] = Array.from(
        document.querySelectorAll('iframe[data-is-storybook][data-is-loaded]')
      );

      const list = nodes.flatMap((e) => {
        try {
          if (!!e.contentWindow && e.dataset.isStorybook !== undefined && e.id === target) {
            return [
              { contentWindow: e.contentWindow, targetOrigin: this.getIframeTargetOrigin(e) },
            ];
          }
          return [];
        } catch (er) {
          return [];
        }
      });

      return list?.length ? list : this.getCurrentFrames();
    }

    // Preview implementation.
    if (global && global.parent && global.parent !== global.self) {
      return [{ contentWindow: global.parent, targetOrigin: this.getManagerTargetOrigin() }];
    }

    return [];
  }

  private getCurrentFrames(): FrameTarget[] {
    // Manager implementation.
    if (this.config.page === 'manager') {
      const list: HTMLIFrameElement[] = Array.from(
        document.querySelectorAll('[data-is-storybook="true"]')
      );
      return list.flatMap((e) =>
        e.contentWindow
          ? [{ contentWindow: e.contentWindow, targetOrigin: this.getIframeTargetOrigin(e) }]
          : []
      );
    }

    // Preview implementation.
    if (global && global.parent) {
      return [{ contentWindow: global.parent, targetOrigin: this.getManagerTargetOrigin() }];
    }

    return [];
  }

  private getIframeTargetOrigin(element: HTMLIFrameElement): string {
    const src = element.getAttribute('src');
    if (src) {
      try {
        const { origin } = new URL(src, document.location.toString());
        if (origin !== 'null') {
          return origin;
        }
      } catch {
        // fall through
      }
    }
    return location?.origin && location.origin !== 'null' ? location.origin : '*';
  }

  // In composition the manager lives on a different origin than this preview; the referrer
  // identifies which host embedded it.
  private getManagerTargetOrigin(): string {
    const referrerOrigin = getReferrerOrigin();

    if (this.originValidator) {
      const isAllowedReferrer = referrerOrigin !== null && this.originValidator(referrerOrigin);
      // A foreign embedder never receives messages addressed to this preview's own origin.
      return isAllowedReferrer ? referrerOrigin : location.origin;
    }

    return referrerOrigin ?? '*';
  }

  private getLocalFrame(): Window[] {
    // Manager implementation.
    if (this.config.page === 'manager') {
      const list: HTMLIFrameElement[] = Array.from(
        document.querySelectorAll('#storybook-preview-iframe')
      );
      return list.flatMap((e) => (e.contentWindow ? [e.contentWindow] : []));
    }

    // Preview implementation.
    if (global && global.parent) {
      return [global.parent];
    }

    return [];
  }

  private isAllowedSender(rawEvent: MessageEvent): boolean {
    if (this.insecureIframeMessaging) {
      return true;
    }

    if (this.config.page === 'manager') {
      return this.isAllowedToContactManager(rawEvent);
    } else if (this.config.page === 'preview') {
      return this.isAllowedToContactPreview(rawEvent);
    }

    return false;
  }

  // A dev-mode preview only accepts messages from its own origin and from local hosts. A built
  // preview, or one served from an opaque origin, has no validator and accepts any message.
  private isAllowedToContactPreview(rawEvent: MessageEvent): boolean {
    if (!this.originValidator) {
      return true;
    }
    if (this.originValidator(rawEvent.origin)) {
      return true;
    }
    this.warnOnceAboutRejectedSender(
      rawEvent,
      `Ignored Storybook channel message from unexpected origin "${rawEvent.origin}". ` +
        `While it runs in dev mode, this preview only accepts messages from local hosts and its own origin. ` +
        `To accept messages from any origin, set "security.insecureIframeMessaging" to true ` +
        `in the main config of the Storybook serving this preview.`
    );
    return false;
  }

  // A channel message reaches the manager only from a preview iframe it rendered itself: the local
  // preview or a composed ref. `event.source` is set by the browser and cannot be forged.
  private isAllowedToContactManager(rawEvent: MessageEvent): boolean {
    const senderFrame = rawEvent.source
      ? Array.from(document.querySelectorAll('iframe')).find(
          (frame) => frame.contentWindow === rawEvent.source
        )
      : undefined;
    if (senderFrame?.hasAttribute('data-is-storybook')) {
      return true;
    }
    this.warnOnceAboutRejectedSender(
      rawEvent,
      `Ignored Storybook channel message from a window that is not a registered preview iframe ` +
        `(origin "${rawEvent.origin}"). The manager only accepts channel messages from its own ` +
        `preview and composed Storybook iframes, never from a page that embeds it. ` +
        `To accept messages from any window, set "security.insecureIframeMessaging" to true.`
    );
    return false;
  }

  private warnOnceAboutRejectedSender(rawEvent: MessageEvent, message: string): void {
    const looksLikeChannelMessage =
      typeof rawEvent.data === 'string' ? rawEvent.data.includes(KEY) : rawEvent.data?.key === KEY;
    if (looksLikeChannelMessage && !this.rejectedOrigins.has(rawEvent.origin)) {
      this.rejectedOrigins.add(rawEvent.origin);
      logger.warn(message);
    }
  }

  private handleEvent(rawEvent: MessageEvent): void {
    try {
      if (!this.isAllowedSender(rawEvent)) {
        return;
      }

      const { data } = rawEvent;
      const { key, event, refId } =
        typeof data === 'string' && isJSON(data) ? parse(data, global.CHANNEL_OPTIONS || {}) : data;

      if (key === KEY) {
        const pageString =
          this.config.page === 'manager'
            ? `<span style="color: #37D5D3; background: black"> manager </span>`
            : `<span style="color: #1EA7FD; background: black"> preview </span>`;

        const eventString = Object.values(EVENTS).includes(event.type)
          ? `<span style="color: #FF4785">${event.type}</span>`
          : `<span style="color: #FFAE00">${event.type}</span>`;

        if (refId) {
          event.refId = refId;
        }

        event.source =
          this.config.page === 'preview' ? rawEvent.origin : getEventSourceUrl(rawEvent);

        if (!event.source) {
          pretty.error(
            `${pageString} received ${eventString} but was unable to determine the source of the event`
          );

          return;
        }
        const message = `${pageString} received ${eventString} (${data.length})`;
        pretty.debug(
          location.origin !== event.source
            ? message
            : `${message} <span style="color: gray">(on ${location.origin} from ${event.source})</span>`,
          ...event.args
        );

        invariant(this.handler, 'ChannelHandler should be set');
        this.handler(event);
      }
    } catch (error) {
      logger.error(error);
    }
  }
}
