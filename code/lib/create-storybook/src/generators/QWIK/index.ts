import { baseGenerator } from '../baseGenerator';
import type { Generator } from '../types';

const generator: Generator = async (packageManager, npmOptions, options) =>
  baseGenerator(packageManager, npmOptions, options, 'qwik', {}, 'qwik');

export default generator;
