```js filename="storybook.test.js" renderer="common" language="js" tabTitle="jest"
import path from 'path';
import * as glob from 'glob';

import { describe, test, expect } from '@jest/globals';

// Replace your-renderer with the renderer you are using (e.g., react, vue3, svelte, etc.)
import { composeStories } from '@storybook/your-renderer';

const compose = (entry) => {
  try {
    return composeStories(entry);
  } catch (e) {
    throw new Error(
      `There was an issue composing stories for the module: ${JSON.stringify(entry)}, ${e}`
    );
  }
};

function getAllStoryFiles() {
  // Place the glob you want to match your stories files
  const storyFiles = glob.sync(
    path.join(__dirname, 'stories/**/*.{stories,story}.{js,jsx,mjs,ts,tsx}')
  );

  return storyFiles.map((filePath) => {
    const storyFile = require(filePath);
    const storyDir = path.dirname(filePath);
    const componentName = path.basename(filePath).replace(/\.(stories|story)\.[^/.]+$/, '');

    return { filePath, storyFile, storyDir, componentName };
  });
}

describe('Stories Snapshots', () => {
  getAllStoryFiles().forEach(({ storyFile, componentName }) => {
    const meta = storyFile.default;
    const title = meta.title || componentName;

    describe(title, () => {
      const stories = Object.entries(compose(storyFile)).map(([name, story]) => ({ name, story }));

      if (stories.length <= 0) {
        throw new Error(
          `No stories found for this module: ${title}. Make sure there is at least one valid story for this module.`
        );
      }

      stories.forEach(({ name, story }) => {
        test(name, async () => {
          const mounted = render(story());
          // Ensures a consistent snapshot by waiting for the component to render by adding a delay of 1 ms before taking the snapshot.
          await new Promise((resolve) => setTimeout(resolve, 1));
          expect(mounted.container).toMatchSnapshot();
        });
      });
    });
  });
});
```

```ts filename="storybook.test.ts" renderer="common" language="ts" tabTitle="jest"
// Replace your-framework with one of the supported Storybook frameworks (react, vue3)
import type { Meta, StoryFn } from '@storybook/your-framework';

import path from 'path';
import * as glob from 'glob';

import { describe, test, expect } from '@jest/globals';

// Replace your-renderer with the renderer you are using (e.g., react, vue3, svelte, etc.)
import { composeStories } from '@storybook/your-renderer';

type StoryFile = {
  default: Meta;
  [name: string]: StoryFn | Meta;
};

const compose = (entry: StoryFile): ReturnType<typeof composeStories<StoryFile>> => {
  try {
    return composeStories(entry);
  } catch (e) {
    throw new Error(
      `There was an issue composing stories for the module: ${JSON.stringify(entry)}, ${e}`
    );
  }
};

function getAllStoryFiles() {
  // Place the glob you want to match your stories files
  const storyFiles = glob.sync(
    path.join(__dirname, 'stories/**/*.{stories,story}.{js,jsx,mjs,ts,tsx}')
  );

  return storyFiles.map((filePath) => {
    const storyFile = require(filePath);
    const storyDir = path.dirname(filePath);
    const componentName = path.basename(filePath).replace(/\.(stories|story)\.[^/.]+$/, '');

    return { filePath, storyFile, storyDir, componentName };
  });
}

describe('Stories Snapshots', () => {
  getAllStoryFiles().forEach(({ storyFile, componentName }) => {
    const meta = storyFile.default;
    const title = meta.title || componentName;

    describe(title, () => {
      const stories = Object.entries(compose(storyFile)).map(([name, story]) => ({ name, story }));

      if (stories.length <= 0) {
        throw new Error(
          `No stories found for this module: ${title}. Make sure there is at least one valid story for this module.`
        );
      }

      stories.forEach(({ name, story }) => {
        test(name, async () => {
          await story.run();
          // Ensures a consistent snapshot by waiting for the component to render by adding a delay of 1 ms before taking the snapshot.
          await new Promise((resolve) => setTimeout(resolve, 1));
          expect(document.body.firstChild).toMatchSnapshot();
        });
      });
    });
  });
});
```

```js filename="storybook.test.js" renderer="common" language="js" tabTitle="vitest"
// @vitest-environment jsdom

import path from 'path';
import { describe, expect, test } from 'vitest';

// Replace your-renderer with the renderer you are using (e.g., react, vue3, svelte, etc.)
import { composeStories } from '@storybook/your-renderer';

const compose = (entry) => {
  try {
    return composeStories(entry);
  } catch (error) {
    throw new Error(
      `There was an issue composing stories for the module: ${JSON.stringify(entry)}, ${error}`
    );
  }
};
function getAllStoryFiles() {
  // Place the glob you want to match your story files
  const storyFiles = Object.entries(
    import.meta.glob('./stories/**/*.(stories|story).@(js|jsx|mjs|ts|tsx)', {
      eager: true,
    })
  );

  return storyFiles.map(([filePath, storyFile]) => {
    const storyDir = path.dirname(filePath);
    const componentName = path.basename(filePath).replace(/\.(stories|story)\.[^/.]+$/, '');
    return { filePath, storyFile, componentName, storyDir };
  });
}
describe('Stories Snapshots', () => {
  getAllStoryFiles().forEach(({ storyFile, componentName }) => {
    const meta = storyFile.default;
    const title = meta.title || componentName;

    describe(title, () => {
      const stories = Object.entries(compose(storyFile)).map(([name, story]) => ({ name, story }));

      if (stories.length <= 0) {
        throw new Error(
          `No stories found for this module: ${title}. Make sure there is at least one valid story for this module.`
        );
      }

      stories.forEach(({ name, story }) => {
        test(name, async () => {
          await story.run();
          // Ensures a consistent snapshot by waiting for the component to render by adding a delay of 1 ms before taking the snapshot.
          await new Promise((resolve) => setTimeout(resolve, 1));
          expect(document.body.firstChild).toMatchSnapshot();
        });
      });
    });
  });
});
```

```ts filename="storybook.test.ts" renderer="common" language="ts" tabTitle="vitest"
// @vitest-environment jsdom

// Replace your-framework with one of the supported Storybook frameworks (react, vue3)
import type { Meta, StoryFn } from '@storybook/your-framework';

import path from 'path';
import { describe, expect, test } from 'vitest';

// Replace your-renderer with the renderer you are using (e.g., react, vue3, svelte, etc.)
import { composeStories } from '@storybook/your-renderer';

type StoryFile = {
  default: Meta;
  [name: string]: StoryFn | Meta;
};

const compose = (entry: StoryFile): ReturnType<typeof composeStories<StoryFile>> => {
  try {
    return composeStories(entry);
  } catch (e) {
    throw new Error(
      `There was an issue composing stories for the module: ${JSON.stringify(entry)}, ${e}`
    );
  }
};

function getAllStoryFiles() {
  // Place the glob you want to match your story files
  const storyFiles = Object.entries(
    import.meta.glob<StoryFile>('./stories/**/*.(stories|story).@(js|jsx|mjs|ts|tsx)', {
      eager: true,
    })
  );

  return storyFiles.map(([filePath, storyFile]) => {
    const storyDir = path.dirname(filePath);
    const componentName = path.basename(filePath).replace(/\.(stories|story)\.[^/.]+$/, '');
    return { filePath, storyFile, componentName, storyDir };
  });
}

describe('Stories Snapshots', () => {
  getAllStoryFiles().forEach(({ storyFile, componentName }) => {
    const meta = storyFile.default;
    const title = meta.title || componentName;

    describe(title, () => {
      const stories = Object.entries(compose(storyFile)).map(([name, story]) => ({ name, story }));

      if (stories.length <= 0) {
        throw new Error(
          `No stories found for this module: ${title}. Make sure there is at least one valid story for this module.`
        );
      }

      stories.forEach(({ name, story }) => {
        test(name, async () => {
          await story.run();
          // Ensures a consistent snapshot by waiting for the component to render by adding a delay of 1 ms before taking the snapshot.
          await new Promise((resolve) => setTimeout(resolve, 1));
          expect(document.body.firstChild).toMatchSnapshot();
        });
      });
    });
  });
});
```
