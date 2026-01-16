# context-in-play-function

<!-- RULE-CATEGORIES:START -->

**Included in these configurations**: <ul><li>recommended</li><li>flat/recommended</li><li>addon-interactions</li><li>flat/addon-interactions</li></ul>

<!-- RULE-CATEGORIES:END -->

## Rule Details

When invoking the play function from another story, it's necessary to pass the full context as an argument to it. The context that Storybook provides to the play function has internal functionality that is necessary for the interactions to work correctly.

Examples of **incorrect** code for this rule:

```js
import { within, userEvent } from '@storybook/testing-library'

MyStory.play = ({ canvasElement }) => {
  const canvas = within(canvasElement)
  // not passing any context
  await MyOtherStory.play()

  userEvent.click(canvas.getByRole('button'))
}
```

```js
import { within, userEvent } from '@storybook/testing-library'

MyStory.play = ({ canvasElement }) => {
  const canvas = within(canvasElement)
  // not passing the full context
  await MyOtherStory.play({ canvasElement })

  userEvent.click(canvas.getByRole('button'))
}
```

Examples of **correct** code for this rule:

```js
import { within, userEvent } from '@storybook/testing-library'

MyStory.play = (context) => {
  const canvas = within(context.canvasElement)
  // passing full context 👍
  await MyOtherStory.play(context)

  await userEvent.click(canvas.getByRole('button'))
}
```

```js
import { within, userEvent } from '@storybook/testing-library'

MyStory.play = ({ context, canvasElement }) => {
  const canvas = within(canvasElement)
  // passing self referencing context property 👍
  await MyOtherStory.play(context)

  await userEvent.click(canvas.getByRole('button'))
}
```

## When Not To Use It

This rule should not be applied in test files. Please ensure you are defining the Storybook rules only for story files. You can see more details [here](https://github.com/storybookjs/storybook/blob/next/code/lib/eslint-plugin#overridingdisabling-rules).
