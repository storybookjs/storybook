import type { Meta, StoryObj } from '@storybook/angular-vite';
import { LibBtnDirective } from './lib-btn.directive';

const meta: Meta<LibBtnDirective> = {
  title: 'Directives/LibBtn',
  component: LibBtnDirective,
};
export default meta;

export const Primary: StoryObj<LibBtnDirective> = {};

export const Secondary: StoryObj<LibBtnDirective> = {
  args: { variant: 'secondary' },
};
