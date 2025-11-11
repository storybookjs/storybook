export type Promisify<Fn> = Fn extends { <_T>(..._args: infer Args): infer Return }
  ? { <_T>(...args: Args): Return extends Promise<any> ? Return : Promise<Return> }
  : Fn extends { (...args: infer Args): infer Return }
    ? { (...args: Args): Return extends Promise<any> ? Return : Promise<Return> }
    : Fn;

export type PromisifyObject<O> = { [K in keyof O]: Promisify<O[K]> };
