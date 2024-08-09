/// <reference path="../../typings.d.ts" />
import { global } from '@storybook/global';

import { logger, pretty } from '@storybook/core/client-logger';
import * as EVENTS from '@storybook/core/core-events';

import { isJSON, parse, stringify } from 'telejson';
import invariant from 'tiny-invariant';

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

// TODO: we should export a method for opening child windows here and keep track of em.
// that way we can send postMessage to child windows as well, not just iframe
// https://stackoverflow.com/questions/6340160/how-to-get-the-references-of-all-already-opened-child-windows

export class PostMessageTransport implements ChannelTransport {
  private buffer: BufferedEvent[];

  private handler?: ChannelHandler;

  private connected = false;

  constructor(private readonly config: Config) {
    this.buffer = [];

    if (typeof global?.addEventListener === 'function') {
      global.addEventListener('message', this.handleEvent.bind(this), false);
    }

    // Check whether the config.page parameter has a valid value
    if (config.page !== 'manager' && config.page !== 'preview') {
      throw new Error(`postmsg-channel: "config.page" cannot be "${config.page}"`);
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
   * Sends `event` to the associated window. If the window does not yet exist
   * the event will be stored in a buffer and sent when the window exists.
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

    frames.forEach((f) => {
      try {
        f.postMessage(data, '*');
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

  private getFrames(target?: string): Window[] {
    if (this.config.page === 'manager') {
      const nodes: HTMLIFrameElement[] = Array.from(
        document.querySelectorAll('iframe[data-is-storybook][data-is-loaded]')
      );

      const list = nodes.flatMap((e) => {
        try {
          if (!!e.contentWindow && e.dataset.isStorybook !== undefined && e.id === target) {
            return [e.contentWindow];
          }
          return [];
        } catch (er) {
          return [];
        }
      });

      return list?.length ? list : this.getCurrentFrames();
    }

    if (global && global.parent && global.parent !== global.self) {
      return [global.parent];
    }

    return [];
  }

  private getCurrentFrames(): Window[] {
    if (this.config.page === 'manager') {
      const list: HTMLIFrameElement[] = Array.from(
        document.querySelectorAll('[data-is-storybook="true"]')
      );
      return list.flatMap((e) => (e.contentWindow ? [e.contentWindow] : []));
    }
    if (global && global.parent) {
      return [global.parent];
    }

    return [];
  }

  private getLocalFrame(): Window[] {
    if (this.config.page === 'manager') {
      const list: HTMLIFrameElement[] = Array.from(
        document.querySelectorAll('#storybook-preview-iframe')
      );
      return list.flatMap((e) => (e.contentWindow ? [e.contentWindow] : []));
    }
    if (global && global.parent) {
      return [global.parent];
    }

    return [];
  }

  private handleEvent(rawEvent: MessageEvent): void {
    try {
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
