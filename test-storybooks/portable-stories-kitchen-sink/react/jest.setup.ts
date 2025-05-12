import '@testing-library/jest-dom';
import { setProjectAnnotations } from '@storybook/react';
import sbAnnotations from './.storybook/preview';

setProjectAnnotations([
  sbAnnotations,
]);
