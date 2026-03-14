import { describe, expect, it } from 'vite-plus/test';

import { ErrorCollector } from './error-collector';

describe('ErrorCollector', () => {
  it('should collect errors', () => {
    const error = new Error('Test error');
    ErrorCollector.addError(error);

    expect(ErrorCollector.getErrors()).toEqual([error]);
  });
});
