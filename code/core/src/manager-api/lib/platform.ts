import { global } from '@storybook/global';

const { navigator } = global;

export const isMacLike = (): boolean =>
  navigator && navigator.platform ? !!navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i) : false;
