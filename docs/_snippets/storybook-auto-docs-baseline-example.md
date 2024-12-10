<!-- prettier-ignore -->
```mdx filename="Button.mdx" renderer="common" language="mdx" tabTitle="custom-title"
import { Meta, Controls } from '@storybook/blocks';

<Meta title="Button" />

# Definition

Button is a clickable interactive element that triggers a response.

You can place text and icons inside of a button.

Buttons are often used for form submissions and to toggle elements into view.

## Usage

The component comes in different variants such as `primary`, `secondary`, `large` and `small` which you can use to alter the look and feel of the button.

## Inputs

Button has the following properties:

<Controls />
```

<!-- prettier-ignore -->
```mdx filename="Button.mdx" renderer="common" language="mdx" tabTitle="of-prop"
import { Meta, Controls } from '@storybook/blocks';

import * as ButtonStories from './Button.stories';

<Meta of={ButtonStories} />

# Definition

Button is a clickable interactive element that triggers a response.

You can place text and icons inside of a button.

Buttons are often used for form submissions and to toggle elements into view.

## Usage

The component comes in different variants such as `primary`, `secondary`, `large` and `small` which you can use to alter the look and feel of the button.

## Inputs

Button has the following properties:

<Controls />
```
