---
title: 'Actions'
---

<YouTubeCallout id="BTIuTuoHsQc" title="STOP logging with Storybook Actions" />

The actions addon is used to display data received by event handler (callback) arguments in your stories.

<video autoPlay muted playsInline loop>
  <source
    src="addon-actions-demo-optimized.mp4"
    type="video/mp4"
  />
</video>

## Action args

Actions work via supplying special Storybook-generated “action” arguments (referred to as "args" for short) to your stories. There are two ways to get an action arg:

### Via @storybook/test fn spy function

The recommended way to write actions is to use the `fn` utility from `@storybook/test` to mock and spy args. This is very useful for writing [interaction tests](../writing-tests/interaction-testing.md). You can mock your component's methods by assigning them to the `fn()` function:

<CodeSnippets
paths={[
'angular/button-story-onclick-action-spy.ts.mdx',
'common/button-story-onclick-action-spy.js.mdx',
'common/button-story-onclick-action-spy.ts.mdx',
]}
/>

If your component calls an arg (because of either the user's interaction or the `play` function) and that arg is spied on , the event will show up in the action panel:

![Essential Actions addon usage](./addon-actions-screenshot.png)

### Automatically matching args

Another option is to use a global parameter to match all [argTypes](../api/arg-types.md) that match a certain pattern. The following configuration automatically creates actions for each `on` argType (which you can either specify manually or can be [inferred automatically](../api/arg-types.md#automatic-argtype-inference)).

This is quite useful when your component has dozens (or hundreds) of methods and you do not want to manually apply the `fn` utility for each of those methods. However, **this is not the recommended** way of writing actions. That's because automatically inferred args **are not available as spies in your play function**. If you use `argTypesRegex` and your stories have play functions, you will need to also define args with the `fn` utility to test them in your play function.

<CodeSnippets
paths={[
'common/storybook-preview-matching-argtypes.js.mdx',
'common/storybook-preview-matching-argtypes.ts.mdx',
]}
/>

If you need more granular control over which `argTypes` are matched, you can adjust your stories and include the `argTypesRegex` parameter. For example:

<CodeSnippets
paths={[
'angular/button-story-matching-argtypes.ts.mdx',
'web-components/button-story-matching-argtypes.js.mdx',
'web-components/button-story-matching-argtypes.ts.mdx',
'common/button-story-matching-argtypes.js.mdx',
'common/button-story-matching-argtypes.ts.mdx',
]}
/>

<Callout variant="info" icon="💡">

If you're generating argTypes with another addon (like [docs](../writing-docs/index.md), which is the common behavior), ensure the actions addon **AFTER** the other addon. You can do this by listing it later in the addons registration code in [`.storybook/main.js`](../configure/index.md#configure-story-rendering). This is default in [essentials](./index.md).

</Callout>

## Action event handlers

It is also possible to detect if your component is emitting the correct HTML events using the `parameters.actions.handles` [parameter](../writing-stories/parameters.md).

<CodeSnippets
paths={[
'angular/button-story-action-event-handle.ts.mdx',
'web-components/button-story-action-event-handle.js.mdx',
'web-components/button-story-action-event-handle.ts.mdx',
'common/button-story-action-event-handle.js.mdx',
'common/button-story-action-event-handle.ts.mdx',
]}
/>

This will bind a standard HTML event handler to the outermost HTML element rendered by your component and trigger an action when the event is called for a given selector. The format is `<eventname> <selector>`. The selector is optional; it defaults to all elements.

## Advanced / legacy usage

There are also some older ways to use actions as documented in the [advanced README](../../addons/actions/ADVANCED.md).
