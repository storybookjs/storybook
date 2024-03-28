export type Asynced<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => PromiseLike<any>
    ? T[K]
    : T[K] extends (...args: infer A) => infer R
      ? (...args: A) => Promise<R>
      : never;
};

interface Serial {
  id: number;
}

export interface RequestMessage extends Serial {
  method: string;
  args: unknown;
}

export type ResponseKind = 'success' | 'error';

export interface ResponseSuccess<T = unknown> extends Serial {
  kind: 'success';
  result: T;
}

export interface ResponseError<E = unknown> extends Serial {
  kind: 'error';
  error: E;
}

export type ResponseMessage<T = unknown, E = unknown> = ResponseSuccess<T> | ResponseError<E>;
