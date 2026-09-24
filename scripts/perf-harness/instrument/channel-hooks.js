// Shared by the browser init script and the server preload. Wraps the Storybook channel as soon as
// `setChannel` assigns it to `globalThis.__STORYBOOK_ADDONS_CHANNEL__`:
// - every transport `send` of a `services:*` event is timed (telejson stringify + native send);
// - `handleEvent` of a `services:*` event is timed (local dispatch: reconcile, apply, relay).
// A send nested in a dispatch (a relay hub forwarding) is subtracted from that dispatch's apply time.
// `hooks.onDispatch(ms)` lets the caller fold dispatch time into the transport frame being received.
function installChannelHooks(hooks) {
  const now = hooks.now;
  let dispatchContext = null;

  const isServices = (event) =>
    event !== null &&
    typeof event === 'object' &&
    typeof event.type === 'string' &&
    event.type.startsWith('services:');
  const serviceIdOf = (event) => {
    const payload = Array.isArray(event.args) ? event.args[0] : undefined;
    return payload && typeof payload.serviceId === 'string' ? payload.serviceId : '';
  };

  const instrument = (channel) => {
    if (!channel || typeof channel !== 'object' || channel.__osaBench) {
      return;
    }
    Object.defineProperty(channel, '__osaBench', { value: true });
    for (const transport of channel.transports ?? []) {
      const link = 'socket' in transport ? 'ws' : 'pm';
      const send = transport.send;
      transport.send = function (event) {
        if (!isServices(event)) {
          return send.apply(this, arguments);
        }
        const t0 = now();
        try {
          return send.apply(this, arguments);
        } finally {
          const ms = now() - t0;
          hooks.sends.push({
            t: hooks.epoch(),
            link,
            type: event.type,
            serviceId: serviceIdOf(event),
            ms,
          });
          if (dispatchContext) {
            dispatchContext.nestedSendMs += ms;
          }
        }
      };
    }
    const handleEvent = channel.handleEvent;
    channel.handleEvent = function (event) {
      if (!isServices(event)) {
        return handleEvent.apply(this, arguments);
      }
      const context = { nestedSendMs: 0 };
      const previous = dispatchContext;
      dispatchContext = context;
      const t0 = now();
      try {
        return handleEvent.apply(this, arguments);
      } finally {
        const ms = now() - t0;
        dispatchContext = previous;
        const remote = hooks.onDispatch(ms);
        hooks.dispatches.push({
          t: hooks.epoch(),
          type: event.type,
          serviceId: serviceIdOf(event),
          remote,
          ms,
          applyMs: ms - context.nestedSendMs,
          relaySendMs: context.nestedSendMs,
        });
      }
    };
  };

  let current = globalThis.__STORYBOOK_ADDONS_CHANNEL__;
  instrument(current);
  Object.defineProperty(globalThis, '__STORYBOOK_ADDONS_CHANNEL__', {
    configurable: true,
    enumerable: true,
    get() {
      return current;
    },
    set(next) {
      current = next;
      instrument(next);
    },
  });
}
