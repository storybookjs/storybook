// @ts-nocheck - the deliberate LoopA/LoopB cycle exercises the misc collector's cycle guard.
export type Outer = Inner;
export type Inner = 'x' | 'y';

export type LoopA = LoopB;
export type LoopB = LoopA;

export enum Numeric {
  Zero,
  One = 1,
}

export enum Weird {
  Computed = 1 << 2,
}
