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

const suggestedIds = (id: string) =>
  suggestEntries(id, candidates).map((candidate) => candidate.id);

describe('suggestEntries', () => {
  it('ranks an exact id first', () => {
    expect(suggestedIds('components-switch')[0]).toBe('components-switch');
  });

  it('finds an id from its bare name, before ids that only contain it', () => {
    expect(suggestedIds('button')).toEqual([
      'components-button',
      'components-buttongroup',
      'components-togglebutton',
    ]);
  });

  it('finds an id with the source glued in front', () => {
    expect(suggestedIds('reshaped-button')[0]).toBe('components-button');
  });

  it('matches a kebab-case guess against a PascalCase name', () => {
    expect(suggestedIds('alert-banner')).toEqual(['feedback-alertbanner', 'components-alert']);
  });

  it('matches a story id by its component', () => {
    expect(suggestedIds('reviews-reviewcard--default')).toEqual(['reviews-reviewcard']);
  });

  it('ignores a word that more than a quarter of the ids share', () => {
    expect(suggestedIds('components-carousel')).toEqual([]);
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

  it('finds the entry a word names even when most ids contain that word', () => {
    const kebab = [
      { id: 'components-button', name: 'Button' },
      { id: 'components-icon-button', name: 'IconButton' },
      { id: 'components-toggle-button', name: 'ToggleButton' },
      { id: 'components-split-button', name: 'SplitButton' },
      { id: 'components-card', name: 'Card' },
    ];

    expect(suggestEntries('button', kebab).map((candidate) => candidate.id)).toEqual([
      'components-button',
    ]);
  });

  it('ranks a docs id in other sources above the component it starts with', () => {
    const intro = ['a', 'b'].map((storybookId) => ({
      id: 'button--docs',
      name: 'Docs',
      storybookId,
    }));
    const button = ['a', 'b'].map((storybookId) => ({ id: 'button', name: 'Button', storybookId }));

    expect(
      suggestEntries('button--docs', [...button, ...intro, { id: 'card', name: 'Card' }])
    ).toEqual([...intro, ...button]);
  });

  it('keeps the source of each suggestion', () => {
    expect(suggestEntries('switch', candidates)).toEqual([
      { id: 'components-switch', name: 'Switch', storybookId: 'reshaped' },
    ]);
  });
});
