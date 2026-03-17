import { describe, expect, it } from 'vite-plus/test';

import { extractComponentDescription } from './extractComponentDescription';

describe('extractComponentDescription', () => {
  it('Extract from docgen', () => {
    expect(extractComponentDescription({ __docgen: { description: 'a description' } })).toBe(
      'a description'
    );
  });
  it('Null Component', () => {
    expect(extractComponentDescription(null)).toBeFalsy();
  });
  it('Missing docgen', () => {
    expect(extractComponentDescription({})).toBeFalsy();
  });
});
