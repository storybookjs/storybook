```ts filename="Button.stories.js|ts" renderer="common" language="ts"
// ...from above
import { expect } from '@storybook/test';

export const PrimaryDisabled = Primary.extend({ args: { disabled: true } });

// 👇 .test method: Attach tests to a story
//    The test function can run the same code as the play function
PrimaryDisabled.test('should be disabled', async ({ canvas, userEvent, args }) => {
  const button = await canvas.findByRole('button');
  await userEvent.click(button);

  await expect(button).toHaveAttribute('aria-disabled', 'true');
  await expect(args.onClick).not.toHaveBeenCalled();
});
```
