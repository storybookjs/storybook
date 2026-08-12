import { expect, it } from 'vitest';

import { getNodeCustomConditions } from './nodeConditions.ts';

it('returns an empty array when no conditions flags are present', () => {
  expect(getNodeCustomConditions([], undefined)).toEqual([]);
});

it('parses --conditions=<value> from execArgv', () => {
  expect(getNodeCustomConditions(['--conditions=@app/src'], undefined)).toEqual(['@app/src']);
});

it('parses --conditions <value> (space-separated) from execArgv', () => {
  expect(getNodeCustomConditions(['--conditions', '@app/src'], undefined)).toEqual(['@app/src']);
});

it('parses -C <value> (space-separated) from execArgv', () => {
  expect(getNodeCustomConditions(['-C', '@app/src'], undefined)).toEqual(['@app/src']);
});

it('parses -C<value> (attached) from execArgv', () => {
  expect(getNodeCustomConditions(['-C@app/src'], undefined)).toEqual(['@app/src']);
});

it('parses --conditions=<value> from NODE_OPTIONS', () => {
  expect(getNodeCustomConditions([], '--conditions=@app/src')).toEqual(['@app/src']);
});

it('parses -C <value> from a NODE_OPTIONS string with multiple flags', () => {
  expect(getNodeCustomConditions([], '--max-old-space-size=4096 -C @app/src')).toEqual([
    '@app/src',
  ]);
});

it('collects repeated flags across execArgv and NODE_OPTIONS in first-seen order', () => {
  expect(
    getNodeCustomConditions(['--conditions=first', '-C', 'second'], '--conditions=third')
  ).toEqual(['first', 'second', 'third']);
});

it('dedupes condition values seen in both execArgv and NODE_OPTIONS', () => {
  expect(getNodeCustomConditions(['--conditions=@app/src'], '-C @app/src')).toEqual(['@app/src']);
});
