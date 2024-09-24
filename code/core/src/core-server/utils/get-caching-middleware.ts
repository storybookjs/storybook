import type { RequestHandler } from 'express';

export function getCachingMiddleware(): RequestHandler {
  return (req, res, next) => {
    res.header('Cache-Control', 'no-store');
    next();
  };
}
