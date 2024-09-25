 renderer="common" language="mdx" tabTitle="custom-title"
```mdx
{/* Button.mdx */}

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

 renderer="common" language="mdx"
```mdx
{/* Button.mdx */}

import { Meta } from '@storybook/blocks';

<Meta title="Button" />

# Definition

Button is a clickable interactive element that triggers a response.

You can place text and icons inside of a button.

Buttons are often used for form submissions and to toggle elements into view.

## Usage

The component comes in different variants such as `primary`, `secondary`, `large` and `small` which you can use to alter the look and feel of the button.

## Inputs

Button has the following properties:

- `primary` - If `true`, the button will have a primary style.
- `size` - The size of the button.
- `label` - The label of the button.
- `backgroundColor` - The background color of the button.
- `onClick` - Callback function when clicked.
```

 renderer="common" language="mdx" tabTitle="of-prop"
```mdx
{/* Button.mdx */}

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

