```js title="next.config.js"
import * as path from 'path';

export default {
  // Any options here are included in Sass compilation for your stories
  sassOptions: {
    includePaths: [path.join(process.cwd(), 'styles')],
  },
};
```