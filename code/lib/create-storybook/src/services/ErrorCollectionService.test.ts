import { describe, expect, it } from 'vitest';

import { ErrorCollectionService } from './ErrorCollectionService';

describe('ErrorCollectionService', () => {
  it('should collect errors', () => {
    const error = new Error('Test error');
    ErrorCollectionService.addError(error);

    expect(ErrorCollectionService.getErrors()).toEqual([error]);
  });
});
