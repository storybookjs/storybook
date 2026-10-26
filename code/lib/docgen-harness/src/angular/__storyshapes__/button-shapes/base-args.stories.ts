// A second story file in the same fixture, so `input.stories.ts` can spread a story's args across
// a real file boundary. Only its args matter; the recorder never builds a payload for this file.
import { ShapeButtonComponent } from './shape-button.component.ts';

export default {
  title: 'AngularShapes/base-args',
  component: ShapeButtonComponent,
};

export const Base = { args: { label: 'from base file', count: 4 } };
