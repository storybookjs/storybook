// Fixture: a barrel that hands out a module of components as one namespace, in each export form.
import * as Imported from './ui';

export * as UI from './ui';
export { Imported };
export { Forwarded } from './forwarded';
export * from './star';
