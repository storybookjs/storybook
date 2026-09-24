// Injected into every frame (manager and preview) before any page script runs, after
// channel-hooks.js. Records per runtime:
// - every channel frame at the transport (websocket send and receive, postMessage receive): event
//   type, bytes, and for received frames the handler time, split into deserialize and dispatch;
// - send and dispatch time of `services:*` events (see channel-hooks.js);
// - structuredClone time, and long tasks with their attribution;
// - in the manager only, "interactions": a status-store frame received, or a key pressed. Each one
//   ends at the first frame painted after the last DOM mutation it caused (see `settle` below).
// The harness pulls and resets this with `__perf.take()`.
(() => {
  if (window.__perf) {
    return;
  }
  const runtime = window === window.top ? 'manager' : 'preview';
  const now = performance.now.bind(performance);
  const epoch = () => performance.timeOrigin + now();
  const HEAD = 600;
  const stringify = JSON.stringify;
  const STATUS_EVENT = 'UNIVERSAL_STORE:storybook/status';

  // Frames carry the channel event type near the start, so reading the head keeps this O(1). For a
  // UniversalStore frame, the second `type` is the store event (e.g. __SET_STATE).
  const TYPE = /"type":"([^"]+)"/g;
  const headInfo = (text) => {
    const head = text.length > HEAD ? text.slice(0, HEAD) : text;
    TYPE.lastIndex = 0;
    const first = TYPE.exec(head);
    const type = first ? first[1] : 'unknown';
    let subtype = '';
    if (type.startsWith('UNIVERSAL_STORE:')) {
      const second = TYPE.exec(head);
      subtype = second ? second[1] : '';
    }
    const serviceId = /"serviceId":"([^"]+)"/.exec(head);
    return { type, subtype, serviceId: serviceId ? serviceId[1] : '' };
  };

  let frames = [];
  let frameCount = 0;
  let clones = { count: 0, ms: 0 };
  let longtasks = [];
  const hooks = { now, epoch, sends: [], dispatches: [], onDispatch: () => false };
  let receiving = null;
  hooks.onDispatch = (ms) => {
    if (receiving === null) {
      return false;
    }
    receiving.dispatchMs += ms;
    return true;
  };
  installChannelHooks(hooks);

  const origClone = globalThis.structuredClone;
  globalThis.structuredClone = function structuredClone(value, options) {
    const t0 = now();
    try {
      return origClone(value, options);
    } finally {
      clones.count += 1;
      clones.ms += now() - t0;
    }
  };

  // --- Interactions ------------------------------------------------------------------------------
  // An interaction starts at a status-store frame's receipt (manager websocket) or at a keydown's
  // event timestamp. DOM mutations in the manager document are credited to the latest interaction.
  // After each mutation batch, and once after the start, we wait for the next animation frame and
  // then a macrotask (rAF + setTimeout 0): that point is after style, layout, and paint of the frame
  // that shows the mutation. `settledAt` is the latest such point; with no mutation it is the first
  // frame after the start. Mutations more than MAX_WINDOW_MS after the start are ignored.
  const MAX_WINDOW_MS = 5000;
  let interactions = [];
  let active = null;
  let lastMutationAt = 0;
  const afterFrame = (fn) => requestAnimationFrame(() => setTimeout(fn, 0));
  const begin = (kind, t0) => {
    const record = {
      kind,
      t0,
      handlerMs: null,
      bytes: null,
      mutations: 0,
      firstFrameAt: null,
      settledAt: null,
    };
    interactions.push(record);
    active = record;
    afterFrame(() => {
      record.firstFrameAt = epoch();
    });
    return record;
  };
  if (runtime === 'manager') {
    const observer = new MutationObserver((list) => {
      lastMutationAt = epoch();
      const record = active;
      if (!record || lastMutationAt - record.t0 > MAX_WINDOW_MS) {
        return;
      }
      record.mutations += list.length;
      afterFrame(() => {
        record.settledAt = Math.max(record.settledAt ?? 0, epoch());
      });
    });
    const observe = () =>
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
    if (document.documentElement) {
      observe();
    } else {
      document.addEventListener('DOMContentLoaded', observe, { once: true });
    }
    window.addEventListener(
      'keydown',
      (event) => {
        if (window.__perf.trackKeys) {
          begin(`key:${event.key}`, performance.timeOrigin + event.timeStamp);
        }
      },
      { capture: true }
    );
  }

  // --- Transport frames --------------------------------------------------------------------------

  // The preview reports the end of every render to the manager with one of these events.
  const RENDER_EVENTS = new Set([
    'storyRendered',
    'docsRendered',
    'storyErrored',
    'storyMissing',
    'storyThrewException',
    'playFunctionThrewException',
  ]);
  const pushFrame = (frame) => {
    frames.push(frame);
    frameCount += 1;
    if (frame.dir === 'in' && frame.link === 'pm' && RENDER_EVENTS.has(frame.type)) {
      window.__perf.lastRender = { type: frame.type, t: frame.t };
    }
  };
  const startFrame = (link, text) => ({
    t: epoch(),
    link,
    dir: 'in',
    ...headInfo(text),
    bytes: text.length,
    receiveMs: 0,
    dispatchMs: 0,
  });
  const receive = (frame, fn, self, args) => {
    const previous = receiving;
    receiving = frame;
    const t0 = now();
    try {
      return fn.apply(self, args);
    } finally {
      frame.receiveMs += now() - t0;
      receiving = previous;
    }
  };

  // Websocket: the channel transport assigns `socket.onmessage` and calls `socket.send`.
  const wsProto = WebSocket.prototype;
  const origSend = wsProto.send;
  wsProto.send = function send(data) {
    if (typeof data === 'string') {
      pushFrame({
        t: epoch(),
        link: 'ws',
        dir: 'out',
        ...headInfo(data),
        bytes: data.length,
        receiveMs: 0,
        dispatchMs: 0,
      });
    }
    return origSend.apply(this, arguments);
  };
  const onmessage = Object.getOwnPropertyDescriptor(wsProto, 'onmessage');
  const handlers = new WeakMap();
  const sockets = [];
  let closes = [];
  Object.defineProperty(wsProto, 'onmessage', {
    configurable: true,
    enumerable: onmessage.enumerable,
    get() {
      return handlers.get(this) ?? null;
    },
    set(fn) {
      if (!sockets.includes(this)) {
        sockets.push(this);
        this.addEventListener('close', (event) => {
          closes.push({
            t: epoch(),
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });
        });
      }
      handlers.set(this, fn);
      if (typeof fn !== 'function') {
        onmessage.set.call(this, fn);
        return;
      }
      onmessage.set.call(this, function (event) {
        if (typeof event.data !== 'string') {
          return fn.apply(this, arguments);
        }
        const frame = startFrame('ws', event.data);
        pushFrame(frame);
        const interaction =
          runtime === 'manager' && frame.type === STATUS_EVENT ? begin('status', frame.t) : null;
        try {
          return receive(frame, fn, this, arguments);
        } finally {
          if (interaction) {
            interaction.handlerMs = frame.receiveMs;
            interaction.bytes = frame.bytes;
          }
        }
      });
    },
  });

  // postMessage: the channel transport listens with `globalThis.addEventListener('message', ...)`.
  // One record per MessageEvent, summed over every listener it reaches.
  const messageFrames = new WeakMap();
  const wrapped = new WeakMap();
  const wrapMessageListener = (listener) =>
    function (event) {
      if (
        typeof event.data !== 'string' ||
        !event.data.slice(0, 64).includes('"key":"storybook-channel"')
      ) {
        return listener.apply(this, arguments);
      }
      let frame = messageFrames.get(event);
      if (!frame) {
        frame = startFrame('pm', event.data);
        messageFrames.set(event, frame);
        pushFrame(frame);
      }
      return receive(frame, listener, this, arguments);
    };
  const origAdd = window.addEventListener;
  const origRemove = window.removeEventListener;
  window.addEventListener = function addEventListener(type, listener, options) {
    if (type === 'message' && typeof listener === 'function') {
      if (!wrapped.has(listener)) {
        wrapped.set(listener, wrapMessageListener(listener));
      }
      return origAdd.call(this, type, wrapped.get(listener), options);
    }
    return origAdd.apply(this, arguments);
  };
  window.removeEventListener = function removeEventListener(type, listener, options) {
    if (type === 'message' && wrapped.has(listener)) {
      return origRemove.call(this, type, wrapped.get(listener), options);
    }
    return origRemove.apply(this, arguments);
  };

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longtasks.push({
          start: performance.timeOrigin + entry.startTime,
          duration: entry.duration,
          attribution: entry.name,
        });
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch {}

  const service = (id) =>
    globalThis[Symbol.for('storybook.open-service.registry')]?.entries?.get(id)?.instance;

  // `.get()` validates and plain-copies its output, so read one component, never the whole map.
  const docgenText = (id) => {
    const payload = service('core/docgen')?.queries.docgen.get({ id });
    return payload === undefined ? undefined : stringify(payload);
  };

  window.__perf = {
    runtime,
    epoch,
    trackKeys: false,
    take() {
      const done = interactions.filter((r) => r !== active);
      const out = {
        runtime,
        frames,
        sends: hooks.sends,
        dispatches: hooks.dispatches,
        clones,
        longtasks,
        closes,
        interactions: done,
      };
      frames = [];
      closes = [];
      hooks.sends = [];
      hooks.dispatches = [];
      clones = { count: 0, ms: 0 };
      longtasks = [];
      interactions = active ? [active] : [];
      return out;
    },
    // Starts an interaction now (manager only).
    begin(kind) {
      begin(kind, epoch());
    },
    // Closes the current interaction so the next `take()` includes it.
    endInteraction() {
      active = null;
    },
    // Resolves once no manager DOM mutation happened for `quietMs` and a frame has painted since.
    async waitSettled(quietMs = 300, timeoutMs = 30_000) {
      const deadline = now() + timeoutMs;
      for (;;) {
        await new Promise((resolve) => afterFrame(resolve));
        if (epoch() - lastMutationAt >= quietMs) {
          return { timedOut: false };
        }
        if (now() > deadline) {
          return { timedOut: true };
        }
        await new Promise((resolve) => setTimeout(resolve, Math.min(quietMs, 100)));
      }
    },
    frameCount: () => frameCount,
    closedSockets: () => sockets.filter((socket) => socket.readyState === WebSocket.CLOSED).length,
    hasService: (id) => service(id) !== undefined,
    // Polls from page start until component `id` has docgen; records the epoch time in `watchHit`.
    watch(id) {
      const tick = () => {
        if (service('core/docgen') && docgenText(id) !== undefined) {
          window.__perf.watchHit = epoch();
        } else {
          setTimeout(tick, 4);
        }
      };
      tick();
    },
    watchHit: null,
    lastRender: null,
    docgenText,
    // Resolves with the epoch time at which component `id`'s docgen JSON contains `marker`
    // (or exists, when `marker` is null), or null on timeout. Polls every 4 ms.
    waitForDocgen(id, marker, timeoutMs = 180_000) {
      const matches = () => {
        const text = docgenText(id);
        return text !== undefined && (marker === null || text.includes(marker));
      };
      return new Promise((resolve) => {
        const deadline = now() + timeoutMs;
        const tick = () => {
          if (matches()) {
            resolve(epoch());
          } else if (now() > deadline) {
            resolve(null);
          } else {
            setTimeout(tick, 4);
          }
        };
        tick();
      });
    },
    async callCommand(serviceId, name, input) {
      const start = epoch();
      let error;
      try {
        await service(serviceId).commands[name](input);
      } catch (e) {
        error = String(e?.message ?? e);
      }
      return { start, end: epoch(), error };
    },
  };
})();
