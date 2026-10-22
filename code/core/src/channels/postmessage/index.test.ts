// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Mock } from 'vitest';

import { InvalidChannelPageError } from '../../preview-errors.ts';
import {
  POOL_FRAME_ATTRIBUTE,
  POOL_FRAME_REPLAY_ATTRIBUTE,
} from '../../shared/constants/frame-pool.ts';
import type { ChannelHandler, Config } from '../types.ts';
import { KEY, PostMessageTransport } from './index.ts';

vi.mock('storybook/internal/client-logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
  pretty: { debug: vi.fn(), error: vi.fn() },
}));

const { logger } = await import('storybook/internal/client-logger');

const OWN_ORIGIN = globalThis.location.origin;
const EVIL_ORIGIN = 'https://evil.example.com';

describe('PostMessageTransport origin validation', () => {
  let handler: Mock<ChannelHandler>;
  let messageListener: (event: MessageEvent) => void;

  const createTransport = (
    page: 'manager' | 'preview',
    { configType = 'DEVELOPMENT' }: { configType?: string } = {}
  ) => {
    vi.stubGlobal('CONFIG_TYPE', configType);
    // The listener is captured instead of dispatched through the window: transports cannot
    // unregister their global listener, so real events would leak between tests.
    vi.stubGlobal(
      'addEventListener',
      vi.fn((type: string, listener: (event: MessageEvent) => void) => {
        if (type === 'message') {
          messageListener = listener;
        }
      })
    );
    const transport = new PostMessageTransport({ page });
    transport.setHandler(handler);
    return transport;
  };

  const receiveChannelMessage = (origin: string, type = 'someEvent') => {
    messageListener(
      new MessageEvent('message', { data: { key: KEY, event: { type, args: [] } }, origin })
    );
  };

  beforeEach(() => {
    handler = vi.fn<ChannelHandler>();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('dev-mode preview', () => {
    it('accepts channel messages from its own origin', () => {
      createTransport('preview');

      receiveChannelMessage(OWN_ORIGIN);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'someEvent', source: OWN_ORIGIN })
      );
    });

    it('drops channel messages from unknown origins and warns once per origin', () => {
      createTransport('preview');

      receiveChannelMessage(EVIL_ORIGIN);
      receiveChannelMessage(EVIL_ORIGIN);

      expect(handler).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(EVIL_ORIGIN));
    });

    it('drops stringified channel messages from unknown origins', () => {
      createTransport('preview');

      messageListener(
        new MessageEvent('message', {
          data: JSON.stringify({ key: KEY, event: { type: 'someEvent', args: [] } }),
          origin: EVIL_ORIGIN,
        })
      );

      expect(handler).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('does not warn about non-channel messages from unknown origins', () => {
      createTransport('preview');

      messageListener(
        new MessageEvent('message', { data: { source: 'react-devtools' }, origin: EVIL_ORIGIN })
      );

      expect(handler).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('accepts local hosts on any port', () => {
      createTransport('preview');

      receiveChannelMessage('http://localhost:7007');
      receiveChannelMessage('http://app.localhost:7007');
      receiveChannelMessage('https://127.0.0.1:7007');

      expect(handler).toHaveBeenCalledTimes(3);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('drops channel messages from 0.0.0.0, IPv6 and other 127.x loopback addresses', () => {
      createTransport('preview');

      receiveChannelMessage('http://0.0.0.0:7007');
      receiveChannelMessage('http://[::1]:7007');
      receiveChannelMessage('http://127.0.0.2:7007');

      expect(handler).not.toHaveBeenCalled();
    });

    it('drops channel messages from LAN hosts', () => {
      createTransport('preview');

      receiveChannelMessage('http://192.168.1.20:6006');

      expect(handler).not.toHaveBeenCalled();
    });

    it('accepts any origin when insecureIframeMessaging is enabled', () => {
      vi.stubGlobal('INSECURE_IFRAME_MESSAGING', true);
      createTransport('preview');

      receiveChannelMessage(EVIL_ORIGIN);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('sends to the parent window with its own origin as target instead of "*"', () => {
      const parent = { postMessage: vi.fn() };
      vi.stubGlobal('parent', parent);
      const transport = createTransport('preview');

      transport.send({ type: 'someEvent', args: [], from: 'preview' });

      expect(parent.postMessage).toHaveBeenCalledWith(expect.any(String), OWN_ORIGIN);
    });

    it('sends to the parent window with the referrer origin when the referrer is an allowed host', () => {
      vi.spyOn(document, 'referrer', 'get').mockReturnValue('http://127.0.0.1:6006/?path=/story/a');
      const parent = { postMessage: vi.fn() };
      vi.stubGlobal('parent', parent);
      const transport = createTransport('preview');

      transport.send({ type: 'someEvent', args: [], from: 'preview' });

      expect(parent.postMessage).toHaveBeenCalledWith(expect.any(String), 'http://127.0.0.1:6006');
    });

    it('sends to the parent window with its own origin when the referrer is not an allowed host', () => {
      vi.spyOn(document, 'referrer', 'get').mockReturnValue(`${EVIL_ORIGIN}/page`);
      const parent = { postMessage: vi.fn() };
      vi.stubGlobal('parent', parent);
      const transport = createTransport('preview');

      transport.send({ type: 'someEvent', args: [], from: 'preview' });

      expect(parent.postMessage).toHaveBeenCalledWith(expect.any(String), OWN_ORIGIN);
    });

    it('sends to the parent window with "*" when insecureIframeMessaging is enabled', () => {
      vi.stubGlobal('INSECURE_IFRAME_MESSAGING', true);
      vi.spyOn(document, 'referrer', 'get').mockReturnValue('http://127.0.0.1:6006/');
      const parent = { postMessage: vi.fn() };
      vi.stubGlobal('parent', parent);
      const transport = createTransport('preview');

      transport.send({ type: 'someEvent', args: [], from: 'preview' });

      expect(parent.postMessage).toHaveBeenCalledWith(expect.any(String), '*');
    });
  });

  describe('built preview', () => {
    it('accepts channel messages from any origin', () => {
      createTransport('preview', { configType: 'PRODUCTION' });

      receiveChannelMessage(EVIL_ORIGIN);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'someEvent' }));
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('sends to the parent window with "*", whatever the referrer', () => {
      vi.spyOn(document, 'referrer', 'get').mockReturnValue('http://127.0.0.1:6006/');
      const parent = { postMessage: vi.fn() };
      vi.stubGlobal('parent', parent);
      const transport = createTransport('preview', { configType: 'PRODUCTION' });

      transport.send({ type: 'someEvent', args: [], from: 'preview' });

      expect(parent.postMessage).toHaveBeenCalledWith(expect.any(String), '*');
    });
  });

  describe('manager', () => {
    // Build a storybook preview iframe whose contentWindow is a known object, and make the
    // transport's DOM queries resolve to it. `src` is set so getEventSourceUrl can resolve the
    // event source once the sender passes the frame check.
    const registerStorybookIframe = (
      attribute = 'data-is-storybook',
      src = `${OWN_ORIGIN}/iframe.html`
    ) => {
      const iframe = document.createElement('iframe');
      iframe.setAttribute(attribute, 'true');
      iframe.setAttribute('src', src);
      const contentWindow = {} as Window;
      Object.defineProperty(iframe, 'contentWindow', { value: contentWindow });
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([iframe] as unknown as ReturnType<
        typeof document.querySelectorAll
      >);
      return contentWindow;
    };

    const receiveFrom = (source: unknown, origin: string, data: unknown) => {
      const event = new MessageEvent('message', { data, origin });
      Object.defineProperty(event, 'source', { value: source });
      messageListener(event);
    };

    it('accepts a channel message from a registered preview iframe', () => {
      const contentWindow = registerStorybookIframe();
      createTransport('manager');

      receiveFrom(contentWindow, OWN_ORIGIN, { key: KEY, event: { type: 'someEvent', args: [] } });

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'someEvent' }));
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('drops and warns on a channel message from a registered iframe on an unexpected origin', () => {
      const contentWindow = registerStorybookIframe();
      createTransport('manager');

      receiveFrom(contentWindow, EVIL_ORIGIN, { key: KEY, event: { type: 'someEvent', args: [] } });

      expect(handler).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(EVIL_ORIGIN));
    });

    it('accepts a channel message from a registered ref iframe on the origin of its src', () => {
      const contentWindow = registerStorybookIframe(
        'data-is-storybook',
        'https://ref.example.com/iframe.html'
      );
      createTransport('manager');

      receiveFrom(contentWindow, 'https://ref.example.com', {
        key: KEY,
        event: { type: 'someEvent', args: [] },
      });

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'someEvent' }));
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('accepts a channel message from a registered iframe on another origin in a built Storybook', () => {
      const contentWindow = registerStorybookIframe();
      createTransport('manager', { configType: 'PRODUCTION' });

      receiveFrom(contentWindow, EVIL_ORIGIN, { key: KEY, event: { type: 'someEvent', args: [] } });

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'someEvent' }));
    });

    it('drops and warns once on a channel message whose source is not a registered iframe', () => {
      registerStorybookIframe();
      createTransport('manager');

      const embedder = {} as Window;
      receiveFrom(embedder, EVIL_ORIGIN, { key: KEY, event: { type: 'someEvent', args: [] } });
      receiveFrom(embedder, EVIL_ORIGIN, { key: KEY, event: { type: 'someEvent', args: [] } });

      expect(handler).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(EVIL_ORIGIN));
    });

    it('drops channel messages from unregistered windows in a built Storybook too', () => {
      registerStorybookIframe();
      createTransport('manager', { configType: 'PRODUCTION' });

      receiveFrom({} as Window, EVIL_ORIGIN, { key: KEY, event: { type: 'someEvent', args: [] } });

      expect(handler).not.toHaveBeenCalled();
    });

    describe('with the frame pool', () => {
      // Frames of the pool all show `iframe.html`; the shown one has `data-is-storybook="true"`.
      const registerPoolFrames = (...frames: { shown: boolean; held?: boolean }[]) => {
        const iframes = frames.map(({ shown, held }) => {
          const iframe = document.createElement('iframe');
          iframe.setAttribute(POOL_FRAME_ATTRIBUTE, '');
          iframe.setAttribute('data-is-storybook', shown ? 'true' : 'false');
          iframe.setAttribute('src', `${OWN_ORIGIN}/iframe.html?id=a--one&framePool=frame`);
          if (held) {
            iframe.setAttribute(POOL_FRAME_REPLAY_ATTRIBUTE, '');
          }
          Object.defineProperty(iframe, 'contentWindow', { value: {} as Window });
          return iframe;
        });
        vi.spyOn(document, 'querySelectorAll').mockReturnValue(
          iframes as unknown as ReturnType<typeof document.querySelectorAll>
        );
        return iframes.map(({ contentWindow }) => contentWindow);
      };
      const message = { key: KEY, event: { type: 'someEvent', args: [] } };

      // Frames in the document, which the transport finds by their attributes.
      const mountPoolFrames = (...shown: boolean[]) =>
        shown.map((isShown) => {
          const iframe = document.createElement('iframe');
          iframe.setAttribute(POOL_FRAME_ATTRIBUTE, '');
          iframe.setAttribute('data-is-storybook', isShown ? 'true' : 'false');
          iframe.setAttribute('data-is-loaded', 'true');
          // happy-dom loads no page in it.
          iframe.setAttribute('src', 'about:blank?id=a--one&framePool=frame');
          const postMessage = vi.fn();
          Object.defineProperty(iframe, 'contentWindow', {
            value: { postMessage, location: { href: `${OWN_ORIGIN}/iframe.html` } },
          });
          document.body.append(iframe);
          return postMessage;
        });

      it('sends only to the shown frame', () => {
        const [hidden, shown, alsoHidden] = mountPoolFrames(false, true, false);
        const transport = createTransport('manager');

        void transport.send({ type: 'someEvent', args: [], from: 'manager' });

        expect(shown).toHaveBeenCalledTimes(1);
        expect(hidden).not.toHaveBeenCalled();
        expect(alsoHidden).not.toHaveBeenCalled();
        document.body.replaceChildren();
      });

      it('never sends the args the manager updates to a frame that is not shown', () => {
        const [hidden, shown] = mountPoolFrames(false, true);
        const transport = createTransport('manager');

        void transport.send({
          type: 'updateStoryArgs',
          args: [{ storyId: 'a--one', updatedArgs: { label: 'Edited' } }],
          from: 'manager',
        });

        expect(shown).toHaveBeenCalledWith(expect.stringContaining('Edited'), OWN_ORIGIN);
        expect(hidden).not.toHaveBeenCalled();
        document.body.replaceChildren();
      });

      it('accepts a channel message from the shown frame, with the path of its src as source', () => {
        const [, shown] = registerPoolFrames({ shown: false }, { shown: true });
        createTransport('manager');

        receiveFrom(shown, OWN_ORIGIN, message);

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'someEvent', source: `${OWN_ORIGIN}/iframe.html` })
        );
      });

      it('drops channel messages from frames that are not shown', () => {
        const [hidden] = registerPoolFrames({ shown: false }, { shown: true });
        createTransport('manager');

        receiveFrom(hidden, OWN_ORIGIN, message);

        expect(handler).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
      });

      it('drops channel messages from the shown frame while the pool holds it', () => {
        const [shown] = registerPoolFrames({ shown: true, held: true });
        createTransport('manager');

        receiveFrom(shown, OWN_ORIGIN, message);

        expect(handler).not.toHaveBeenCalled();
      });
    });

    it('drops channel messages from a review thumbnail without warning', () => {
      const contentWindow = registerStorybookIframe('data-is-storybook-thumbnail');
      createTransport('manager');

      receiveFrom(contentWindow, OWN_ORIGIN, { key: KEY, event: { type: 'someEvent', args: [] } });

      expect(handler).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('accepts channel messages from unregistered windows when insecureIframeMessaging is enabled', () => {
      vi.stubGlobal('INSECURE_IFRAME_MESSAGING', true);
      const location = { origin: OWN_ORIGIN, pathname: '/iframe.html' };
      const iframe = document.createElement('iframe');
      iframe.setAttribute('data-is-storybook', 'true');
      iframe.setAttribute('src', `${OWN_ORIGIN}/iframe.html`);
      Object.defineProperty(iframe, 'contentWindow', { value: { location } });
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([iframe] as unknown as ReturnType<
        typeof document.querySelectorAll
      >);
      createTransport('manager');

      // A same-origin window at the preview's path that the manager did not render, such as an
      // addon's own preview iframe.
      receiveFrom({ location }, OWN_ORIGIN, { key: KEY, event: { type: 'someEvent', args: [] } });

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'someEvent' }));
    });

    it('does not warn about non-channel messages from an unknown window', () => {
      registerStorybookIframe();
      createTransport('manager');

      receiveFrom({} as Window, EVIL_ORIGIN, { source: 'react-devtools' });

      expect(handler).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('sends to a preview iframe with the origin derived from its src instead of "*"', () => {
      // The iframe stays detached (happy-dom would otherwise try to load its cross-origin src),
      // so the transport's DOM queries are stubbed to return it.
      const iframe = document.createElement('iframe');
      iframe.setAttribute('data-is-storybook', 'true');
      iframe.setAttribute('data-is-loaded', 'true');
      iframe.id = 'storybook-preview-iframe';
      iframe.setAttribute('src', 'https://ref.example.com/iframe.html');
      const postMessage = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', { value: { postMessage } });
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([iframe] as unknown as ReturnType<
        typeof document.querySelectorAll
      >);

      const transport = createTransport('manager');
      transport.send(
        { type: 'someEvent', args: [], from: 'manager' },
        { target: 'storybook-preview-iframe' }
      );

      expect(postMessage).toHaveBeenCalledWith(expect.any(String), 'https://ref.example.com');
    });

    it('skips a preview iframe until it leaves its initial about:blank document', () => {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('data-is-storybook', 'true');
      iframe.setAttribute('src', 'https://ref.example.com/iframe.html');
      const postMessage = vi.fn();
      const contentWindow = { postMessage, location: { href: 'about:blank' } };
      Object.defineProperty(iframe, 'contentWindow', { value: contentWindow });
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([iframe] as unknown as ReturnType<
        typeof document.querySelectorAll
      >);

      const transport = createTransport('manager');
      transport.send({ type: 'someEvent', args: [], from: 'manager' });

      expect(postMessage).not.toHaveBeenCalled();

      contentWindow.location = {
        get href(): string {
          throw new DOMException(
            'Blocked a frame from accessing a cross-origin frame.',
            'SecurityError'
          );
        },
      };
      transport.send({ type: 'someEvent', args: [], from: 'manager' });

      expect(postMessage).toHaveBeenCalledWith(expect.any(String), 'https://ref.example.com');
    });

    it('sends to a preview iframe with "*" in a built Storybook', () => {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('data-is-storybook', 'true');
      iframe.setAttribute('data-is-loaded', 'true');
      iframe.id = 'storybook-preview-iframe';
      iframe.setAttribute('src', 'https://ref.example.com/iframe.html');
      const postMessage = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', { value: { postMessage } });
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([iframe] as unknown as ReturnType<
        typeof document.querySelectorAll
      >);

      const transport = createTransport('manager', { configType: 'PRODUCTION' });
      transport.send(
        { type: 'someEvent', args: [], from: 'manager' },
        { target: 'storybook-preview-iframe' }
      );

      expect(postMessage).toHaveBeenCalledWith(expect.any(String), '*');
    });

    it('sends to a preview iframe with "*" when insecureIframeMessaging is enabled', () => {
      vi.stubGlobal('INSECURE_IFRAME_MESSAGING', true);
      const iframe = document.createElement('iframe');
      iframe.setAttribute('data-is-storybook', 'true');
      iframe.setAttribute('data-is-loaded', 'true');
      iframe.id = 'storybook-preview-iframe';
      iframe.setAttribute('src', 'https://ref.example.com/iframe.html');
      const postMessage = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', { value: { postMessage } });
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([iframe] as unknown as ReturnType<
        typeof document.querySelectorAll
      >);

      const transport = createTransport('manager');
      transport.send(
        { type: 'someEvent', args: [], from: 'manager' },
        { target: 'storybook-preview-iframe' }
      );

      expect(postMessage).toHaveBeenCalledWith(expect.any(String), '*');
    });
  });
});

describe('PostMessageTransport configuration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws InvalidChannelPageError for a page other than manager or preview', () => {
    vi.stubGlobal('addEventListener', vi.fn());

    expect(() => new PostMessageTransport({ page: 'other' } as unknown as Config)).toThrow(
      InvalidChannelPageError
    );
  });
});
