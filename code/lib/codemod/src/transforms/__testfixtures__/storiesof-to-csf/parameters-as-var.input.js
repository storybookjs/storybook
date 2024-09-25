import React from 'react';
import { storiesOf } from '@storybook/react';
import Canvas from './Canvas';

const CHROMATIC_DELAY = { chromatic: { delay: 500 } };

storiesOf('Canvas', module).add('loading', () => <Canvas loading />, CHROMATIC_DELAY);
