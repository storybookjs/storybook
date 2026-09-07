# Storybook Channel

Storybook Channel is similar to an EventEmitter.
Channels are used with Storybook implementations to send/receive events between the Storybook Manager and the Storybook Renderer.

```js
class Channel {
  addListener(type, listener) {}
  addPeerListener(type, listener) {} // ignore events from itself
  emit(type, ...args) {}
  eventNames() {}
  listenerCount(type) {}
  listeners(type) {}
  on(type, listener) {}
  once(type, listener) {}
  prependListener(type, listener) {}
  prependOnceListener(type, listener) {}
  removeAllListeners(type) {}
  removeListener(type, listener) {}
}
```

The channel takes a Transport object as a parameter which will be used to send/receive messages. The transport object should implement this interface.

```js
class Transport {
  send(event) {}
  setHandler(handler) {}
}
```

For more information visit: [storybook.js.org](https://storybook.js.org)

## Channel access (internal)

Storybook installs one shared addons channel per runtime (manager, preview iframe, dev server).
Use the channel-slot API from `storybook/internal/channels` in TypeScript — not direct reads of
`__STORYBOOK_ADDONS_CHANNEL__`.

| Operation | API |
| --------- | --- |
| Read (nullable) | `getChannel()` |
| Read (installed) | `requireChannel()` — use when the runtime entry has already installed a channel |
| Install / replace | `setChannel(channel)` or `addons.setChannel(channel)` |
| Clear | `clearChannel()` / `setChannel(null)` |

The global `__STORYBOOK_ADDONS_CHANNEL__` is mirrored when `setChannel` runs so builder preamble and
legacy snippets stay in sync. `getChannel()` reads the global slot first so duplicate bundles still
see the live channel.

**Per-runtime install (call sites do not wait):**

- **Preview iframe:** builders run generated `addons.setChannel(createBrowserChannel(...))` before `preview.ts` loads.
- **Manager:** `addons.setChannel` during manager boot, before `addons.register` callbacks.
- **Node server:** `services` preset calls `setChannel(options.channel)` before registering services; a noop channel is also bootstrapped at import in non-browser realms.
- **Tests:** `setChannel(mock)` in `beforeEach`, or rely on the Node import bootstrap noop.
