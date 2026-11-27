// Fixture: a barrel whose declared value shadows a namespace of the same name from an `export *`.
import { ButtonComponent } from '../button.component';

export * from './decoy';
export const UI = { Button: ButtonComponent };
