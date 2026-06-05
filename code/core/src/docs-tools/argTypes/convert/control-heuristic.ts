import { RADIO_CONTROL_THRESHOLD } from './utils';

export function getControlTypeForOptions(options: any[]): 'radio' | 'select' {
  return options.length <= RADIO_CONTROL_THRESHOLD ? 'radio' : 'select';
}
