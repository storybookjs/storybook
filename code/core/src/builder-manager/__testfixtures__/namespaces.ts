namespace Events {
  export const CHANGE = 'change';
}

namespace Events {
  export const ALL = [CHANGE];
}

Object.assign(globalThis, { result: Events.ALL });

export {};
