import { describe, expect, it } from 'vitest';

import { WebpackCompilationError } from '../server-errors';

describe('WebpackCompilationError', () => {
  it('should correctly handle error with stats.compilation.errors', () => {
    const errors = [
      new Error('Error 1 \u001B[4mmessage\u001B[0m'),
      new Error('\u001B[4mError\u001B[0m 2 message'),
    ];

    const webpackError = new WebpackCompilationError({ errors });

    expect(webpackError.data.errors[0].message).toEqual('Error 1 message');
    expect(webpackError.data.errors[1].message).toEqual('Error 2 message');
  });
});
