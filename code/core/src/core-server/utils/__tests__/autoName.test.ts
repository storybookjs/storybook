import { expect, it } from 'vite-plus/test';

import { autoName } from '../autoName';

it('pulls name from named MDX files', () => {
  expect(autoName('Conventions.mdx', 'Button.mdx', 'Docs')).toEqual('Conventions');
});

it('falls back for default named MDX files', () => {
  expect(autoName('Button.mdx', 'Button.stories.jsx', 'Docs')).toEqual('Docs');
});
