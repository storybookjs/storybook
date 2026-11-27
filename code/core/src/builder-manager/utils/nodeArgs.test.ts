import { expect, it } from 'vitest';

import { getNodeExecArgs } from './nodeArgs.ts';

it('returns execArgv as-is when NODE_OPTIONS is unset', () => {
  expect(getNodeExecArgs(['-C', '@app/src'], '')).toEqual(['-C', '@app/src']);
});

it('appends tokenized NODE_OPTIONS after execArgv', () => {
  expect(getNodeExecArgs(['-C', 'first'], '-C second')).toEqual(['-C', 'first', '-C', 'second']);
});

it('collapses extra whitespace between NODE_OPTIONS flags', () => {
  expect(getNodeExecArgs([], '  --conditions=first   -C  second  ')).toEqual([
    '--conditions',
    'first',
    '-C',
    'second',
  ]);
});

it('splits --flag=value into separate tokens', () => {
  expect(getNodeExecArgs(['--conditions=@app/src'], '')).toEqual(['--conditions', '@app/src']);
});

it('leaves flags without "=" untouched', () => {
  expect(getNodeExecArgs(['-C', '@app/src'], '')).toEqual(['-C', '@app/src']);
});

it('returns an empty array when both sources are empty', () => {
  expect(getNodeExecArgs([], '')).toEqual([]);
});
