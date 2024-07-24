if (typeof Promise.withResolvers === "undefined") {
  Promise.withResolvers = <T>(): {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    // biome-ignore lint/suspicious/noExplicitAny: any is needed for the reject function
    reject: (reason?: any) => void;
  } => {
    let resolve: (value: T | PromiseLike<T>) => void;
    let reject: (reason?: unknown) => void;

    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    // @ts-ignore
    return { promise, resolve, reject };
  };
}
