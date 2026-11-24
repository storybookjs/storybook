import { b } from './cycle-b.js';

const make = () => 'A';

export const a = make();
export const readB = () => b;
