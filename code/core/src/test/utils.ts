export type Promisify<Fn> = Fn extends (...args: infer A) => infer R
  ? (...args: A) => R extends Promise<any> ? R : Promise<R>
  : Fn;

export type PromisifyObject<O> = { [K in keyof O]: Promisify<O[K]> };
