---
title: 'Measure & outline'
---

<YouTubeCallout id="-S7GtH0hdc4" title="Debug CSS without DevTools — Storybook" />

Storybook's [Measure](https://storybook.js.org/addons/@storybook/addon-measure/) and [Outline](https://storybook.js.org/addons/@storybook/addon-outline) addons give you the necessary tooling to inspect and visually debug CSS layout and alignment issues within your stories. It makes it easy to catch UI bugs early in development.

## Measure addon

While working with composite components or page layouts, dealing with whitespace (i.e., `margin`,`padding`,`border`) and individual component measurements can be pretty troublesome. It would require that you open up the browser's development tools and manually inspect the DOM tree for issues and UI bugs.

With Storybook's Measure addon, you can quickly visualize each component's measurements through a click of a button in Storybook's toolbar.

<video autoPlay muted playsInline loop>
  <source src="addon-measure-optimized.mp4" type="video/mp4" />
</video>

<Callout variant="info" icon="💡">

Alternatively you can press the `m` key on your keyboard to toggle the addon.

</Callout>

## Outline addon

When building your layouts, checking the visual alignment of all components can be pretty complicated, even more, if your components are spread apart or contain unique shapes.

With Storybook's Outline addon, you can toggle the outlines associated with all your UI elements, allowing you to spot bugs and broken layouts instantly with a click of a button.

<video autoPlay muted playsInline loop>
  <source src="addon-outline-optimized.mp4" type="video/mp4"/>
</video>
