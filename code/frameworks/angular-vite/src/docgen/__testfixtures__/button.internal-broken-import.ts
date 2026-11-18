/** Fixture: a story-config module whose own import is what fails to resolve, not the story file's. */
import { ButtonComponent } from './does-not-exist.component';

export const config = { component: ButtonComponent, args: {} };
