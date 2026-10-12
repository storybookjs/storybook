export class Control {
  constructor(readonly value: string) {}
}

export const SHARED_CONTROL = new Control('shared');

export const shout = (value: string) => value.toUpperCase();
