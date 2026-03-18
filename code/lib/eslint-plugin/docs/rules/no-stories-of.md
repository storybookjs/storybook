# storiesOf is deprecated and should not be used (no-stories-of)

<!-- RULE-CATEGORIES:START -->

**Included in these configurations**: <ul><li>csf-strict</li><li>flat/csf-strict</li></ul>

<!-- RULE-CATEGORIES:END -->

## Rule Details

Starting with Storybook 5.2, the Component Story Format ([CSF](https://storybook.js.org/docs/api/csf)) was introduced as the preferred way to write stories. The `storiesOf` API is now removed and should be avoided in favor of CSF.

Examples of **incorrect** code for this rule:

```js
import { storiesOf } from '@storybook/react';

import Button from '../components/Button';

storiesOf('Button', module).add('primary', () => <Button primary />);
```

Examples of **correct** code for this rule:

```js
import Button from '../components/Button';

export default = {
  component: Button
}

export const Primary = () => <Button primary />
```

```js
import Button from '../components/Button';

export default = {
  component: Button
}

export const Primary = {
  args: {
    primary: true
  }
}
```

## Further Reading

For more information about the change from `storiesOf` to `CSF`, read here: https://github.com/storybookjs/storybook/blob/master/lib/core/docs/storiesOf.md

To automatically migrate all of your codebase, run this codemod in the root folder of your project:

```sh
npx storybook@latest migrate storiesof-to-csf --glob="*/**/*.stories.@(tsx|jsx|ts|js)"
```
