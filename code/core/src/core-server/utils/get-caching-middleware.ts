import type { Middleware } from '../../types/index.ts';

/**
 * Storybook's own responses in dev (the manager, `index.json`, `project.json`, ...) change without
 * their URL changing, so the browser must never keep them.
 */
export function getCachingMiddleware(): Middleware {
  return (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  };
}

/**
 * The preview builder caches its own responses. Vite revalidates a module by its ETag and answers a
 * bare `304`; with Storybook's `no-store` on that `304`, the browser drops the module it has and
 * downloads it again on the next load.
 *
 * Registered right before the preview builder. Register `getCachingMiddleware` again after it, for
 * the routes that come later.
 */
export function getPreviewBuilderCachingMiddleware(): Middleware {
  return (req, res, next) => {
    res.removeHeader('Cache-Control');
    next();
  };
}
