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

Each runtime has one shared addons channel; inside a Node process, each Storybook instance has its own.
Use the channel-slot API from `storybook/internal/channels` in TypeScript, not direct reads of `__STORYBOOK_ADDONS_CHANNEL__`.

| Operation | API |
| --------- | --- |
| Read (nullable) | `getChannel()` |
| Read (installed) | `requireChannel()` — use when the runtime entry has already installed a channel |
| Install / replace | `setChannel(channel)` or `addons.setChannel(channel)` |
| Clear | `clearChannel()` / `setChannel(null)` |

Lookup order in `getChannel()`:

- Inside an instance, it returns the instance's channel.
- Otherwise it reads the global slot first, so duplicate bundles still see the live channel, then the module slot.

`setChannel` inside an instance replaces the instance's channel; outside one it writes the module slot and mirrors it to `__STORYBOOK_ADDONS_CHANNEL__` for builder preamble and legacy snippets.

Per-runtime install (call sites do not wait):

- Preview iframe: builders run generated `addons.setChannel(createBrowserChannel(...))` before `preview.ts` loads.
- Manager: `addons.setChannel` during manager boot, before `addons.register` callbacks.
- Node: each instance creates its channel in `createStorybook`; nothing on the server calls `setChannel`.
  - Outside an instance, a noop channel is bootstrapped at import in non-browser realms.
- Tests: `setChannel(mock)` in `beforeEach`, or rely on the Node import bootstrap noop.
