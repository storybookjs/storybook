```js filename="Button.stories.js|jsx" renderer="react" language="js"
import React, { useState } from 'react';

import { Button } from './Button';

export default {
  component: Button,
};

/*
 * Example Button story with React Hooks.
 * See note below related to this example.
 */
const ButtonWithHooks = () => {
  // Sets the hooks for both the label and primary props
  const [value, setValue] = useState('Secondary');
  const [isPrimary, setIsPrimary] = useState(false);

  // Sets a click handler to change the label's value
  const handleOnChange = () => {
    if (!isPrimary) {
      setIsPrimary(true);
      setValue('Primary');
    }
  };
  return <Button primary={isPrimary} onClick={handleOnChange} label={value} />;
};

export const Primary = {
  render: () => <ButtonWithHooks />,
};
```

```tsx filename="Button.stories.ts|tsx" renderer="react" language="ts-4-9"
import React, { useState } from 'react';

import { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 * Example Button story with React Hooks.
 * See note below related to this example.
 */
const ButtonWithHooks = () => {
  // Sets the hooks for both the label and primary props
  const [value, setValue] = useState('Secondary');
  const [isPrimary, setIsPrimary] = useState(false);

  // Sets a click handler to change the label's value
  const handleOnChange = () => {
    if (!isPrimary) {
      setIsPrimary(true);
      setValue('Primary');
    }
  };
  return <Button primary={isPrimary} onClick={handleOnChange} label={value} />;
};

export const Primary = {
  render: () => <ButtonWithHooks />,
} satisfies Story;
```

```tsx filename="Button.stories.ts|tsx" renderer="react" language="ts"
import React, { useState } from 'react';

import { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

/*
 * Example Button story with React Hooks.
 * See note below related to this example.
 */
const ButtonWithHooks = () => {
  // Sets the hooks for both the label and primary props
  const [value, setValue] = useState('Secondary');
  const [isPrimary, setIsPrimary] = useState(false);

  // Sets a click handler to change the label's value
  const handleOnChange = () => {
    if (!isPrimary) {
      setIsPrimary(true);
      setValue('Primary');
    }
  };
  return <Button primary={isPrimary} onClick={handleOnChange} label={value} />;
};

export const Primary: Story = {
  render: () => <ButtonWithHooks />,
};
```

```js filename="Button.stories.js|jsx" renderer="solid" language="js"
import { createSignal } from 'solid-js';

import { Button } from './Button';

export default {
  component: Button,
};

/*
 * Example Button story with Solid Hooks.
 * See note below related to this example.
 */
const ButtonWithHooks = () => {
  // Sets the hooks for both the label and primary props
  const [value, setValue] = createSignal('Secondary');
  const [isPrimary, setIsPrimary] = createSignal(false);

  // Sets a click handler to change the label's value
  const handleOnChange = () => {
    if (!isPrimary()) {
      setIsPrimary(true);
      setValue('Primary');
    }
  };
  return <Button primary={isPrimary()} onClick={handleOnChange} label={value()} />;
};

export const Primary = {
  render: () => <ButtonWithHooks />,
};
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { createSignal } from 'solid-js';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 * Example Button story with Solid Hooks.
 * See note below related to this example.
 */
const ButtonWithHooks = () => {
  // Sets the hooks for both the label and primary props
  const [value, setValue] = createSignal('Secondary');
  const [isPrimary, setIsPrimary] = createSignal(false);

  // Sets a click handler to change the label's value
  const handleOnChange = () => {
    if (!isPrimary()) {
      setIsPrimary(true);
      setValue('Primary');
    }
  };
  return <Button primary={isPrimary()} onClick={handleOnChange} label={value()} />;
};

export const Primary = {
  render: () => <ButtonWithHooks />,
} satisfies Story;
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { createSignal } from 'solid-js';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

/*
 * Example Button story with Solid Hooks.
 * See note below related to this example.
 */
const ButtonWithHooks = () => {
  // Sets the hooks for both the label and primary props
  const [value, setValue] = createSignal('Secondary');
  const [isPrimary, setIsPrimary] = createSignal(false);

  // Sets a click handler to change the label's value
  const handleOnChange = () => {
    if (!isPrimary()) {
      setIsPrimary(true);
      setValue('Primary');
    }
  };
  return <Button primary={isPrimary()} onClick={handleOnChange} label={value()} />;
};

export const Primary: Story = {
  render: () => <ButtonWithHooks />,
};
```
