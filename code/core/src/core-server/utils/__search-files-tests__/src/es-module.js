/* eslint-disable import/no-unresolved */
import * as ns from 'external2';

export var p = 5;

export function q() {}

export class C {}

export { x as externalName } from 'external';

export { ns };

export default function () {
  return 'default';
}
