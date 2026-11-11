// Fixture: a barrel whose destructured value shadows a namespace of the same name from an `export *`.
import { ButtonComponent } from '../button.component';

export * from './decoy';
export const { UI } = { UI: { Button: ButtonComponent } };
