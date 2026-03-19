import '@testing-library/jest-dom';
import { setProjectAnnotations } from '@storybook/react-vite';
import sbAnnotations from './.storybook/preview';

setProjectAnnotations([sbAnnotations]);
