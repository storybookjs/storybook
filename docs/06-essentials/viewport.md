---
title: 'Viewport'
---

<YouTubeCallout id="uydF1ltw7-g" title="Stop resizing your browser — Storybook viewport" />

The Viewport toolbar item allows you to adjust the dimensions of the iframe your story is rendered in. It makes it easy to develop responsive UIs.

<video autoPlay muted playsInline loop>
  <source
    src="addon-viewports-optimized.mp4"
    type="video/mp4"
  />
</video>

### Configuration

Out of the box, the Viewport addon offers you a standard set of viewports that you can use.

If you want to change the default set of viewports, you can set the global `parameters.viewport` [parameter](../writing-stories/parameters.md) in your [`.storybook/preview.js`](../configure/index.md#configure-story-rendering):

<CodeSnippets
paths={[
'common/storybook-preview-change-viewports.js.mdx',
'common/storybook-preview-change-viewports.ts.mdx',
]}
/>

The viewport global can take an object with the following keys:

| Field                  |  Type   |                        Description                        | Default Value  |
| ---------------------- | :-----: | :-------------------------------------------------------: | :------------: |
| **defaultViewport**    | String  |                 Sets the default viewport                 | `'responsive'` |
| **defaultOrientation** | String  | Sets the default orientation (e.g. portrait or landscape) |  `'portrait'`  |
| **disable**            | Boolean |                   Disables the viewport                   |      N/A       |
| **viewports**          | Object  |         The configuration object for the viewport         |      `{}`      |

The viewports object needs the following keys:

| Field      |  Type  | Description                                          |    Example values    |
| ---------- | :----: | :--------------------------------------------------- | :------------------: |
| **name**   | String | Name for the viewport                                |    `'Responsive'`    |
| **styles** | Object | Sets Inline styles to be applied to the story        | `{width:0,height:0}` |
| **type**   | String | Type of the device (e.g. desktop, mobile, or tablet) |      `desktop`       |

### Use a detailed set of devices

By default, Storybook uses a [minimal set of viewports](https://github.com/storybookjs/storybook/blob/next/code/addons/viewport/src/defaults.ts#L167) to get you started. But you're not restricted to these. The addon offers a more granular list of devices that you can use.

Change your [`.storybook/preview.js`](../configure/index.md#configure-story-rendering) to the following:

<CodeSnippets
paths={[
'common/storybook-preview-granular-viewports.js.mdx',
'common/storybook-preview-granular-viewports.ts.mdx',
]}
/>

Start your Storybook, and you'll see the new devices that you can use.

See [here](https://github.com/storybookjs/storybook/blob/master/addons/viewport/src/defaults.ts#L3) the complete list of devices and their configurations.

### Add new devices

If you have either a specific viewport or a list of viewports that you need to use, you can modify your [`.storybook/preview.js`](../configure/index.md#configure-story-rendering) file and include them:

<CodeSnippets
paths={[
'common/storybook-preview-viewport-add-devices.js.mdx',
]}
/>

Make the following change to use them in your Storybook:

<CodeSnippets
paths={[
'common/storybook-preview-viewport-use-new-devices.js.mdx',
'common/storybook-preview-viewport-use-new-devices.ts.mdx',
]}
/>

Once you start Storybook, you'll see your new viewports and devices.

If you need, you can also add these two to another list of viewports.

For instance, if you want to use these two with the minimal set of viewports, you can do it like so:

<CodeSnippets
paths={[
'common/storybook-preview-merge-viewports.js.mdx',
'common/storybook-preview-merge-viewports.ts.mdx',
]}
/>

Both viewports (`Kindle Fire 2` and `Kindle Fire HD`) will feature in the list of devices by merging them into the [`MINIMAL_VIEWPORTS`](https://github.com/storybookjs/storybook/blob/next/code/addons/viewport/src/defaults.ts#L167).

### Configuring per component or story

There are cases where it's not practical for you to use a specific visual viewport on a global scale, and you need it to adjust it to an individual story.

Update your story through [parameters](../writing-stories/parameters.md) to include your viewports at a component level or for a specific story:

<CodeSnippets
paths={[
'react/my-component-story-configure-viewports.js.mdx',
'react/my-component-story-configure-viewports.ts.mdx',
'vue/my-component-story-configure-viewports.js.mdx',
'vue/my-component-story-configure-viewports.ts.mdx',
'angular/my-component-story-configure-viewports.ts.mdx',
'web-components/my-component-story-configure-viewports.js.mdx',
'web-components/my-component-story-configure-viewports.ts.mdx',
'svelte/my-component-story-configure-viewports.js.mdx',
'solid/my-component-story-configure-viewports.js.mdx',
'solid/my-component-story-configure-viewports.ts.mdx',
]}
usesCsf3
csf2Path="essentials/viewport#snippet-my-component-story-configure-viewports"
/>

### Keyboard shortcuts

- Previous viewport: <kbd>shift</kbd> + <kbd>v</kbd>
- Next viewport: <kbd>v</kbd>
- Reset viewport: <kbd>alt</kbd> + <kbd>v</kbd>

If you need, you can edit them on the shortcuts page.
