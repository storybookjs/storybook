export type Response<T> =
  | null
  | {
      data: T;
      error: null;
    }
  | {
      data: null;
      error: any;
    };
