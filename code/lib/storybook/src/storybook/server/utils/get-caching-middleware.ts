import type { Middleware } from '@storybook/core/internal/types';

export function getCachingMiddleware(): Middleware {
  return (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  };
}
