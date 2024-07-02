import type { NextHandleFunction } from './server-connect';

export function getCachingMiddleware(): NextHandleFunction {
  return (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  };
}
