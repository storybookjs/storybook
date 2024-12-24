import { styled } from '@storybook/core/theming';

import { withReset } from './lib/common';

/**
 * This is a "local" reset to style subtrees with Storybook styles
 *
 * We can't style individual elements (e.g. h1, h2, etc.) in here because the CSS specificity is too
 * high, so those styles can too easily override child elements that are not expecting it.
 */

export const ResetWrapper = styled.div(withReset);
