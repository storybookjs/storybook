```js filename="your-addon-register-file.js" renderer="common" language="js"
import React from 'react';

import { useGlobals } from '@storybook/manager-api';

import { AddonPanel, Placeholder, Separator, Source, Spaced, Title } from '@storybook/components';

import { MyThemes } from '../my-theme-folder/my-theme-file';

// Function to obtain the intended theme
const getTheme = (themeName) => {
  return MyThemes[themeName];
};

const ThemePanel = (props) => {
  const [{ theme: themeName }] = useGlobals();

  const selectedTheme = getTheme(themeName);

  return (
    <AddonPanel {...props}>
      {selectedTheme ? (
        <Spaced row={3} outer={1}>
          <Title>{selectedTheme.name}</Title>
          <p>The full theme object</p>
          <Source
            code={JSON.stringify(selectedTheme, null, 2)}
            language="js"
            copyable
            padded
            showLineNumbers
          />
        </Spaced>
      ) : (
        <Placeholder>No theme selected</Placeholder>
      )}
    </AddonPanel>
  );
};
```

