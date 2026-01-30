import * as blocks from '../blocks';

describe('blocks module compatibility exports', () => {
  test('exports ArgsTable', () => {
    expect(blocks.ArgsTable).toBeDefined();
  });

  test('ArgsTable equals PureArgsTable', () => {
    expect(blocks.ArgsTable).toBe(blocks.PureArgsTable);
  });
});
