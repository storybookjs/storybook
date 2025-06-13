import { expect, it, vi } from 'vitest';

import { importPipeline } from './importPipeline';

const createGate = (): [Promise<any | undefined>, (_?: any) => void] => {
  let openGate = (_?: any) => {};
  const gate = new Promise<any | undefined>((resolve) => {
    openGate = resolve;
  });
  return [gate, openGate];
};

it('passes through to passed importFn on serial calls', async () => {
  const pipeline = importPipeline();
  const importFn = vi.fn();

  importFn.mockResolvedValueOnce('r1');
  expect(await pipeline(() => importFn('i1'))).toEqual('r1');
  expect(importFn).toHaveBeenCalledTimes(1);
  expect(importFn).toHaveBeenCalledWith('i1');

  importFn.mockResolvedValueOnce('r2');
  expect(await pipeline(() => importFn('i2'))).toEqual('r2');
  expect(importFn).toHaveBeenCalledTimes(2);
  expect(importFn).toHaveBeenCalledWith('i2');
});

it('blocks on parallel calls', async () => {
  const pipeline = importPipeline();
  const [firstGate, openFirstGate] = createGate();
  const importFn = vi
    .fn()
    .mockImplementationOnce(() => firstGate)
    .mockResolvedValueOnce('r2');

  const firstPromise = pipeline(() => importFn('i1'));

  // We need to await promise resolution to get the block setup
  await new Promise((r) => r(null));

  const secondPromise = pipeline(() => importFn('i2'));

  expect(importFn).toHaveBeenCalledTimes(1);
  expect(importFn).toHaveBeenCalledWith('i1');
  openFirstGate('r1');
  expect(await firstPromise).toEqual('r1');

  // We need to await promise resolution to get past the block
  await new Promise((r) => r(null));

  expect(importFn).toHaveBeenCalledTimes(2);
  expect(importFn).toHaveBeenCalledWith('i2');
  expect(await secondPromise).toEqual('r2');
});

it('dispatches all queued calls on opening', async () => {
  const pipeline = importPipeline();
  const [firstGate, openFirstGate] = createGate();
  const importFn = vi
    .fn()
    .mockImplementationOnce(() => firstGate)
    .mockResolvedValueOnce('r2')
    .mockResolvedValueOnce('r3');

  const firstPromise = pipeline(() => importFn('i1'));

  // We need to await promise resolution to get the block setup
  await new Promise((r) => r(null));
  const secondPromise = pipeline(() => importFn('i2'));

  // We need to await promise resolution to get the block setup
  await new Promise((r) => r(null));
  const thirdPromise = pipeline(() => importFn('i3'));

  expect(importFn).toHaveBeenCalledTimes(1);
  expect(importFn).toHaveBeenCalledWith('i1');
  openFirstGate('r1');
  expect(await firstPromise).toEqual('r1');

  // We need to await promise resolution to get past the block
  await new Promise((r) => r(null));

  expect(importFn).toHaveBeenCalledTimes(3);
  expect(importFn).toHaveBeenCalledWith('i2');
  expect(importFn).toHaveBeenCalledWith('i3');
  expect(await secondPromise).toEqual('r2');
  expect(await thirdPromise).toEqual('r3');
});

it('blocks sequentially on parallel calls', async () => {
  const pipeline = importPipeline();
  const [firstGate, openFirstGate] = createGate();
  const [secondGate, openSecondGate] = createGate();
  const importFn = vi
    .fn()
    .mockImplementationOnce(() => firstGate)
    .mockImplementationOnce(() => secondGate)
    .mockResolvedValueOnce('r3');

  const firstPromise = pipeline(() => importFn('i1'));

  // We need to await promise resolution to get the block setup
  await new Promise((r) => r(null));
  const secondPromise = pipeline(() => importFn('i2'));

  expect(importFn).toHaveBeenCalledTimes(1);
  expect(importFn).toHaveBeenCalledWith('i1');
  openFirstGate('r1');
  expect(await firstPromise).toEqual('r1');

  // We need to await promise resolution to get past the block, and set up the new one
  await new Promise((r) => r(null));
  const thirdPromise = pipeline(() => importFn('i3'));

  expect(importFn).toHaveBeenCalledTimes(2);
  expect(importFn).toHaveBeenCalledWith('i2');
  openSecondGate('r2');
  expect(await secondPromise).toEqual('r2');

  // We need to await promise resolution to get past the block
  await new Promise((r) => r(null));
  expect(await thirdPromise).toEqual('r3');
});
