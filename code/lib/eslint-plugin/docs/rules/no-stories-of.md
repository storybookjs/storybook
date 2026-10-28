# storiesOf was removed in Storybook 8.0; use CSF instead (no-stories-of)

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
import Button from "../components/Button";

export default = {
  component: Button
}

export const Primary = () => <Button primary />
```

```js
import Button from "../components/Button";

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

For more information about the change from `storiesOf` to `CSF`, read the [Storybook 8.0 migration guide](https://storybook.js.org/docs/8/migration-guide/from-older-version), and write your stories in [CSF](https://storybook.js.org/docs/api/csf) instead.
