import type { Middleware } from '../../types/index.ts';

export function getCachingMiddleware(): Middleware {
  return (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  };
}
