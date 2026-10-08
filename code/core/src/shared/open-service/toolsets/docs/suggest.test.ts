import { describe, expect, it } from 'vitest';

import { suggestEntries } from './suggest.ts';

const reshaped = [
  'Alert',
  'Avatar',
  'Badge',
  'Button',
  'ButtonGroup',
  'Card',
  'Switch',
  'ToggleButton',
].map((name) => ({
  id: `components-${name.toLowerCase()}`,
  name,
  storybookId: 'reshaped',
}));
const candidates = [
  { id: 'reviews-reviewcard', name: 'ReviewCard', storybookId: 'local' },
  { id: 'feedback-alertbanner', name: 'AlertBanner', storybookId: 'local' },
  ...reshaped,
];

const ids = (id: string) => suggestEntries(id, candidates).map((candidate) => candidate.id);

describe('suggestEntries', () => {
  it('ranks an exact id first', () => {
    expect(ids('components-switch')[0]).toBe('components-switch');
  });

  it('finds an id from its bare name, before ids that only contain it', () => {
    expect(ids('button')).toEqual([
      'components-button',
      'components-buttongroup',
      'components-togglebutton',
    ]);
  });

  it('finds an id with the source glued in front', () => {
    expect(ids('reshaped-button')[0]).toBe('components-button');
  });

  it('matches a kebab-case guess against a PascalCase name', () => {
    expect(ids('alert-banner')).toEqual(['feedback-alertbanner', 'components-alert']);
  });

  it('matches a story id by its component', () => {
    expect(ids('reviews-reviewcard--default')).toEqual(['reviews-reviewcard']);
  });

  it('ignores words most ids share', () => {
    expect(ids('components-carousel')).toEqual([]);
  });

  it('ranks the same id in every other source first, however many have it', () => {
    const everywhere = ['a', 'b', 'c'].map((storybookId) => ({
      id: 'switch',
      name: 'Switch',
      storybookId,
    }));

    expect(
      suggestEntries('switch', [...everywhere, { id: 'button', name: 'Button', storybookId: 'a' }])
    ).toEqual(everywhere);
  });

  it('finds the entry a word names even when most ids share that word', () => {
    const kebab = ['button', 'icon-button', 'toggle-button', 'split-button', 'card'].map(
      (name) => ({
        id: `components-${name}`,
        name: name.replace(/(^|-)(\w)/g, (_, _dash, letter: string) => letter.toUpperCase()),
      })
    );

    expect(suggestEntries('button', kebab).map((candidate) => candidate.id)).toEqual([
      'components-button',
    ]);
  });

  it('keeps the source of each suggestion', () => {
    expect(suggestEntries('switch', candidates)).toEqual([
      { id: 'components-switch', name: 'Switch', storybookId: 'reshaped' },
    ]);
  });
});
