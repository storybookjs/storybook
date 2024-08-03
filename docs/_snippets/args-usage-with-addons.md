```js filename="my-addon/src/manager.js|ts" renderer="common" language="js"
import { useArgs } from '@storybook/manager-api';

const [args, updateArgs, resetArgs] = useArgs();

// To update one or more args:
updateArgs({ key: 'value' });

// To reset one (or more) args:
resetArgs((argNames: ['key']));

// To reset all args
resetArgs();
```

