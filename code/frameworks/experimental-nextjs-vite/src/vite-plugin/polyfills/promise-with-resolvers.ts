if (typeof Promise.withResolvers === 'undefined') {
  Promise.withResolvers = <T>(): {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
  } => {
    let resolve: (value: T | PromiseLike<T>) => void;
    let reject: (reason?: unknown) => void;

    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    // @ts-expect-error: TS doesn't know about the resolve and reject properties
    return { promise, resolve, reject };
  };
}
