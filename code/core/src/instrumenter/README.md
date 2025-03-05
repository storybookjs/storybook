# Storybook Instrumenter

The Storybook Instrumenter is used to patch a (3rd party) module to track and intercept function invocations for step-through debugging using the Interactions addon. In essence, the Instrumenter traverses a given object, recursively monkey-patching any functions to make them "tracked".

During normal operation, tracked functions simply call through to their original function, forwarding the return value. As a side-effect, they also emit a `call` event whenever they are invoked.

Through `options`, functions can be marked "interceptable", which give them another mode of operation. In this "intercept" mode, the original function is _not_ invoked, instead the interceptable function returns a `Promise` which only resolves when receiving an event to do so. This enables step-through debugging, directly in the browser. A consequence of this design is that all interceptable functions must be `await`-ed, even if their original function is not asynchronous (i.e. it normally does not return a Promise).

## API

The primary way to use the Storybook Instrumenter is through the `instrument` function:

```ts
instrument<TObj extends Record<string, any>>(obj: TObj, options: Options): TObj
```

`instrument` takes a plain JS object or imported ES module, and optionally an `options` object. It traverses the input object, recursively iterating over object properties and arrays. Any values with typeof `function` are tracked (through monkey-patching). Finally, a shallow copy of the original object is returned (with functions replaced). If the `mutate: true` option is set, the original object is mutated instead of returning a shallow copy.

### Options

- [`intercept`](#intercept) Control which instrumented functions are interceptable.
- [`mutate`](#mutate) Mutate and return the input object rather than returning a shallow copy.
- [`path`](#path) Virtual object path to prepend to the actual input object function paths.
- [`retain`](#retain) Retain calls across renders and when switching stories.

#### `intercept`

> `boolean | ((method: string, path: Array<string | CallRef>) => boolean)`

Depending on the library and functions to be instrumented, you may want to configure some or all functions to be interceptable. Interceptable calls are _debuggable_, meaning they can be paused on. When paused, an interceptable function will not invoke it's original function, but rather return a pending Promise. This promise is only resolved when stepping over the call in the debugger. Only interceptable calls will appear as rows in the Interactions addon panel. Non-interceptable calls may appear as inline arguments to an interceptable function.

`intercept` can take either a boolean (default `false`) or a function which returns a boolean. This enables you to only make specific library functions interceptable. This function receives a `method` and `path`, referring to the name of the function and the path to that function in the object tree. Some functions may return an object which is then instrumented as well, in which case the `path` will contain a "call ref", which is a plain object containing a `__callId__` property referencing the originating call.

Here's an example `intercept` function (from `@storybook/test`):

```js
(method, path) => path[0] === 'fireEvent' || method.startsWith('findBy') || method.startsWith('waitFor'),
```

This means all methods under `fireEvent` (an object) are instrumentable, as well as any methods which name starts with `findBy` or `waitFor`.

#### `mutate`

> `boolean`

By default, `instrument` creates a shallow clone of the input object, replacing functions with their tracked counterparts without affecting the original input object. This is usually the safest and most predictable behavior, but in some situations you may have to rely on mutation. By setting `mutate: true` you can enable this behavior. Be careful though: mutating a Node module can lead to hard-to-debug issues.

#### `path`

> `Array<string | CallRef>`

Storybook Interactions will automatically generate a pseudo-code representation of tracked function calls based on their metadata. For example, this call:

```js
{ path: ['userEvent'], method: 'keyboard', args: ['hello'], ... }
```

Will print as `userEvent.keyboard("hello")`.

By default, the call `path` is determined by the hierarchy of the input object. To get the above result, your input object would have to look something like this:

```js
{ userEvent: { keyboard: function(text) { ... } } }
```

The `path` config option allows you to prepend elements to the normal path. So if your input object does not have a `userEvent` property, but directly contains `keyboard`, then you can set `path: ['userEvent']` to correct for this.

#### `retain`

> `boolean`

On rare occasions, you may have an instrumented function that's invoked outside the context of a story render or play function. One example can be found in `argsEnhancers` which run when Storybook is initialized, but aren't rerun when you switch or rerun stories. Normally, the Storybook Instrumenter clears its internal record of calls when switching between stories, losing track of those function calls which happened on initialization. Set `retain: true` to keep these calls on record while switching or rerunning stories.

> Note that retained functions should not be interceptable.

## Events

The Storybook Instrumenter uses the [Storybook Channel API](../channels/README.md) to send and receive events.

### Emitted tracking events

The instrumenter emits two types of events for tracking function invocations ("calls"):

- [`storybook/instrumenter/call`](#storybook-instrumenter-call) Provides call metadata whenever a tracked function is invoked.
- [`storybook/instrumenter/sync`](#storybook-instrumenter-sync) Provides a call log after one or more tracked functions are invoked.

#### `storybook/instrumenter/call`

This event is emitted whenever a tracked function is invoked (a "call").

The event payload consists of all metadata about the function invocation, including a unique `id`, any arguments, the method name and object path. However, the order of events is not guaranteed and you may receive the same call multiple times while debugging. Moreover, this event is emitted for _all_ tracked calls, not just interceptable ones.

#### `storybook/instrumenter/sync`

This event is emitted whenever a tracked function is invoked, but the event is debounced until the next "tick", so multiple consecutive synchronous calls will trigger a single `sync` event.

The event payload object contains an array of `logItems` and a `controlStates` object. The `logItems` array represent a "normalized" log of _interceptable_ calls. The order of calls in this log is guaranteed and step-through debugging will not append to the log but rather update it to set the proper `status` for each call. The log does not contain full call metadata but only a `callId` property, so this must be mapped onto received `storybook/instrumenter/call` events. For the value of `controlStates`, see [Control states](#control-states).

An example `sync` payload may look like this:

```js
{
  controlStates: {
    start: false,
    back: false,
    goto: true,
    next: true,
    end: true,
  },
  logItems: [
    { callId: 'tooltip--hovered [0] hover', status: 'waiting' }
  ]
}
```

### Received control events

The instrumenter listens for these control events:

- `storybook/instrumenter/start` - Remount the story and start the debugger at the first interceptable call
- `storybook/instrumenter/back` - Remount the story and start the debugger at the previous interceptable call
- `storybook/instrumenter/goto` - Fast-forwards to - or remounts and starts debugging at - the given interceptable call
- `storybook/instrumenter/next` - Resolves the Promise for the currently intercepted call, letting execution continue to the next call
- `storybook/instrumenter/end` - Resolves all Promises for intercepted calls, letting execution continue to the end

Remounting is achieved through emitting Storybook's `forceRemount` event. In some situations, this will trigger a full page refresh (of the preview) in order to flush pending promises (e.g. long-running interactions).

## Control states

Besides patching functions, the instrumenter keeps track of "control states". These indicate whether the debugger is available, and which control events are available for use:

- `start: boolean` - Whether emitting `storybook/instrumenter/start` would work
- `back: boolean` - Whether emitting `storybook/instrumenter/back` would work
- `goto: boolean` - Whether emitting `storybook/instrumenter/goto` would work
- `next: boolean` - Whether emitting `storybook/instrumenter/next` would work
- `end: boolean` - Whether emitting `storybook/instrumenter/end` would work

These values are provided in the `controlStates` object on the `storybook/instrumenter/sync` event payload.
