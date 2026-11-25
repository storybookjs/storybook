import { describe, expect, it } from 'vitest';

import { loadCsf } from '../../csf-tools/index.ts';
import { extractDeclaredSubcomponents } from './subcomponents.ts';

const declaredNames = (source: string) =>
  extractDeclaredSubcomponents(loadCsf(source, { makeTitle: () => 'Button' }).parse()).map(
    ({ name, componentName }) => [name, componentName]
  );

describe('extractDeclaredSubcomponents', () => {
  it('reads identifier, string and template keys', () => {
    expect(
      declaredNames(`import { Icon, Header, Footer } from './ui';
                     export default { subcomponents: { Icon, 'Header': Header, [\`Footer\`]: Footer } };`)
    ).toEqual([
      ['Icon', 'Icon'],
      ['Header', 'Header'],
      ['Footer', 'Footer'],
    ]);
  });

  it('leaves out a computed key, whose name is known only when the story runs', () => {
    expect(
      declaredNames(`import { Icon, Header } from './ui';
                     const label = 'Icon';
                     export default { subcomponents: { [label]: Icon, Header } };`)
    ).toEqual([['Header', 'Header']]);
  });
});
