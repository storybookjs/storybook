```jsx filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import React, { useState } from 'react';

import { Button } from './Button';

export default {
  component: Button,
};

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

```tsx filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
import React, { useState } from 'react';

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

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

```tsx filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import React, { useState } from 'react';

import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

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

export const Primary = meta.story({
  render: () => <ButtonWithHooks />,
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```jsx filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import React, { useState } from 'react';

import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

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

export const Primary = meta.story({
  render: () => <ButtonWithHooks />,
});
```

```jsx filename="Button.stories.js|jsx" renderer="solid" language="js"
import { createSignal } from 'solid-js';

import { Button } from './Button';

export default {
  component: Button,
};

const ButtonWithHooks = () => {
  // Sets the signals for both the label and primary props
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

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { createSignal } from 'solid-js';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

const ButtonWithHooks = () => {
  // Sets the signals for both the label and primary props
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
