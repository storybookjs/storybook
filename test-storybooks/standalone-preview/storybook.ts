import './addPreview';
import { configure } from '@storybook/react';

import * as Comp1 from './stories/Component1.stories';
import * as Comp2 from './stories/Component2.stories';

configure(() => [Comp1, Comp2], module);
