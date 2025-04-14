import boxen, { type Options } from 'boxen';

export const printBoxedMessage = (message: string, style?: Options) =>
  boxen(message, { borderStyle: 'round', padding: 1, borderColor: '#F1618C', ...style });
