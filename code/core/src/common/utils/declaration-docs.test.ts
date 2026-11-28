import { join } from 'pathe';

import { describe, expect, it } from 'vitest';

import { readDeclarationDocs } from './declaration-docs.ts';

const FIXTURES = join(import.meta.dirname, '__testfixtures__/declaration-docs');

const read = (file: string, exportName: string) =>
  readDeclarationDocs({ path: join(FIXTURES, file), exportName });

describe('readDeclarationDocs', () => {
  it('reads the description and the tags of the docblock on a declaration', () => {
    expect(read('Button.tsx', 'Button')).toMatchObject({
      name: 'Button',
      description: 'A button for the main action in a view.',
      tags: { summary: ['for user actions'] },
    });
  });

  it('reads the declaration behind a default export of its name', () => {
    expect(read('Card.tsx', 'default')).toMatchObject({
      name: 'Card',
      description: 'A card that groups related content.',
    });
  });

  it('reads the docblock above the decorators of a class', () => {
    expect(read('Badge.ts', 'BadgeComponent')).toMatchObject({
      name: 'BadgeComponent',
      description: 'A badge that counts.',
    });
  });

  it('reads the last docblock above a declaration, as TypeScript does', () => {
    expect(read('Chip.tsx', 'Chip')?.description).toBe('A chip that filters a list.');
  });

  it('reads the docblocks of the component and of a type of the same name, as TypeScript merges them', () => {
    expect(read('Merged.tsx', 'Merged')).toMatchObject({
      description:
        'The props of a merged component.\nA component that shares its name with a type.',
    });
  });

  it('reads the docblock above a statement for each variable it declares', () => {
    expect(read('Pair.tsx', 'First')?.description).toBe('Two components that share a docblock.');
    expect(read('Pair.tsx', 'Second')?.description).toBe('Two components that share a docblock.');
  });

  it('does not take the docblock above an import for the one on the declaration', () => {
    expect(read('kit.ts', 'Panel')).toBeUndefined();
  });

  it('reads nothing where the module does not declare the export', () => {
    expect(read('Button.tsx', 'Absent')).toBeUndefined();
  });

  it('reads nothing without a module that can be read', () => {
    expect(read('Absent.tsx', 'Button')).toBeUndefined();
    expect(readDeclarationDocs({ exportName: 'Button' })).toBeUndefined();
  });
});
