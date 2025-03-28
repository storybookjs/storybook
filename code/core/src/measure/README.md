# Storybook Addon Measure

Storybook addon for inspecting layouts and visualizing the box model.

1. Press the <kbd>m</kbd> key to enable the addon:

2. Hover over a DOM node

3. Storybook will display the dimensions of the selected element—margin, padding, border, width and height—in pixels.

![](https://user-images.githubusercontent.com/42671/119589961-dff9b380-bda1-11eb-9550-7ae28bc70bf4.gif)

## Usage

This addon requires Storybook 6.3 or later. Measure is part of [essentials](https://storybook.js.org/docs/essentials) and so is installed in all new Storybooks by default. If you need to add it to your Storybook, you can run:

```sh
npm i -D @storybook/addon-measure
```

Add `"@storybook/addon-measure"` to the addons array in your `.storybook/main.js`:

```js
export default {
  addons: ['@storybook/addon-measure'],
};
```

### Inspiration

- [Inspx](https://github.com/raunofreiberg/inspx) by Rauno Freiberg
- [Aaron Westbrook's script](https://gist.github.com/awestbro/e668c12662ad354f02a413205b65fce7)
- [Visbug](https://visbug.web.app/) from the Chrome team
