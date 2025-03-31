import '@testing-library/jest-dom';
import { setProjectAnnotations } from '@storybook/nextjs';

/**
 * For some weird reason, Jest in Nextjs throws the following error:
 * Cannot find module '.storybook/preview' from 'jest.setup.ts
 *
 * when using import sbAnnotations from './.storybook/preview';
 */
const sbAnnotations = require('./.storybook/preview');

setProjectAnnotations([
  sbAnnotations,
]);
