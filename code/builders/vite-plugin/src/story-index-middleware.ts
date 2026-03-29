import type { StoryIndexGenerator } from 'storybook/internal/core-server';

import type { Connect } from 'vite';

export function createStoryIndexMiddleware(
  storyIndexGenerator: StoryIndexGenerator,
  basePath: string
): Connect.NextHandleFunction {
  const indexPath = `${basePath}index.json`;

  return async (req, res, next) => {
    if (req.url !== indexPath) {
      return next();
    }

    try {
      const index = await storyIndexGenerator.getIndex();
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.write(JSON.stringify(index));
      res.end();
    } catch (error) {
      next(error);
    }
  };
}
