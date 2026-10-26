export interface User {
  /** The display name. */
  name: string;
  age: number;
}

export enum Color {
  Red = 'red',
  Green = 'green',
}

export enum Level {
  Low,
  High,
}

export type ID = string;

export type Shapes = 'circle' | 'square';

// A pure alias-to-alias cycle (`type A = B; type B = A`) is unrepresentable in valid TS
// (TS2456), so the cyclic case is expressed as mutually recursive object aliases instead.
export type AliasA = { peer: AliasB };
export type AliasB = { peer: AliasA };

export interface BigInterface {
  p00: string;
  p01: string;
  p02: string;
  p03: string;
  p04: string;
  p05: string;
  p06: string;
  p07: string;
  p08: string;
  p09: string;
  p10: string;
  p11: string;
  p12: string;
  p13: string;
  p14: string;
  p15: string;
  p16: string;
  p17: string;
  p18: string;
  p19: string;
  p20: string;
  p21: string;
  p22: string;
}

export type Dict = Record<string, number>;

export namespace AppTypes {
  export interface Nested {
    key: string;
    count: number;
  }
}

export interface Prefs {
  theme?: string;
  density?: 'cozy' | 'compact';
  /** Where it is stored. */
  locale: string;
}

// A local alias naming a library type: the alias declaration is in-project, but the expansion
// target (Date) is a lib declaration that must stay flat.
export type LocalDate = Date;

// Mapped-type aliases over local types: lib.d.ts declares the instantiated mapped type itself,
// so the expansion gate must judge member origins — these resolve to the user's properties
// (from `User`) and must expand, unlike `LocalDate`.
export type Picked = Pick<User, 'name'>;
export type Partialed = Partial<User>;
