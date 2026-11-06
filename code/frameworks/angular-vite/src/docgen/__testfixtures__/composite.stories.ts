import { ButtonComponent } from './button.component';
import { ColorPickerComponent } from './color-picker.component';

export default {
  title: 'Composite',
  component: ButtonComponent,
  subcomponents: { ColorPicker: ColorPickerComponent },
};

export const Default = {};
