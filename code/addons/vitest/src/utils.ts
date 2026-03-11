import type { ErrorLike } from './types';

export function errorToErrorLike(error: Error): ErrorLike {
  return {
    message: error.message,
    name: error.name,
    // avoid duplicating the error message in the stack trace
    stack: error.message + ' ' + error.stack?.replace(error.message, ''),
    cause: error.cause && error.cause instanceof Error ? errorToErrorLike(error.cause) : undefined,
  };
}
