```tsx filename="src/components/ThemeAwareComponent.tsx" renderer="react" language="ts"
import React from 'react';
import { useGlobals } from '@storybook/preview-api';

export const ThemeAwareComponent: React.FC = () => {
  const [globals] = useGlobals();
  const theme = globals.theme || 'light';

  return (
    <div style={{ padding: '1rem', background: theme === 'dark' ? '#333' : '#fff' }}>
      Current theme: {theme}
    </div>
  );
};
```

```mdx filename="Component.mdx" renderer="common" language="mdx"
import { ThemeAwareComponent } from '../src/components/ThemeAwareComponent';

# Component Documentation

<ThemeAwareComponent />

This component uses the `useGlobals` hook internally and will update when globals change.
```

