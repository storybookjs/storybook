```tsx filename="Button.test.tsx" renderer="react" language="ts"
import { jest, test, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
// 👉 Using Next.js? Import from @storybook/nextjs instead
import { composeStory } from '@storybook/react';

import meta, { Primary as PrimaryStory } from './Button.stories';

test('onclick handler is called', () => {
  // Returns a story which already contains all annotations from story, meta and global levels
  const Primary = composeStory(PrimaryStory, meta);

  const onClickSpy = jest.fn();
  await Primary.run({ args: { ...Primary.args, onClick: onClickSpy } });

  const buttonElement = screen.getByRole('button');
  buttonElement.click();
  expect(onClickSpy).toHaveBeenCalled();
});
```

```ts filename="Button.test.ts" renderer="vue" language="ts"
import { jest, test, expect } from '@jest/globals';
import { render, screen } from '@testing-library/vue';
import { composeStory } from '@storybook/vue3';

import meta, { Primary as PrimaryStory } from './Button.stories';

test('onclick handler is called', () => {
  // Returns a story which already contains all annotations from story, meta and global levels
  const Primary = composeStory(PrimaryStory, meta);

  const onClickSpy = jest.fn();
  await Primary.run({ args: { ...Primary.args, onClick: onClickSpy } });

  const buttonElement = screen.getByRole('button');
  buttonElement.click();
  expect(onClickSpy).toHaveBeenCalled();
});
```
