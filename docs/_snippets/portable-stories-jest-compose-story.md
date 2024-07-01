```tsx filename="Button.test.tsx" renderer="react" language="ts"
import { jest, test, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
// 👉 Using Next.js? Import from @storybook/nextjs instead
import { composeStory } from '@storybook/react';

import meta, { Primary } from './Button.stories';

test('onclick handler is called', () => {
  // Returns a story which already contains all annotations from story, meta and global levels
  const PrimaryStory = composeStory(Primary, meta);

  const onClickSpy = jest.fn();
  render(<PrimaryStory onClick={onClickSpy} />);
  const buttonElement = screen.getByRole('button');
  buttonElement.click();
  expect(onClickSpy).toHaveBeenCalled();
});
```

```ts filename="Button.test.ts" renderer="vue" language="ts"
import { jest, test, expect } from '@jest/globals';
import { render, screen } from '@testing-library/vue';
import { composeStory } from '@storybook/vue3';

import meta, { Primary } from './Button.stories';

test('onclick handler is called', () => {
  // Returns a story which already contains all annotations from story, meta and global levels
  const PrimaryStory = composeStory(Primary, meta);

  const onClickSpy = jest.fn();
  render(Primary, { props: { onClick: onClickSpy } });
  const buttonElement = screen.getByRole('button');
  buttonElement.click();
  expect(onClickSpy).toHaveBeenCalled();
});
```

