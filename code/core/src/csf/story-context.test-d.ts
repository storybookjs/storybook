import type { BoundFunctions } from '@testing-library/dom';
import type { userEvent } from '@testing-library/user-event';
import { expectTypeOf } from 'vitest';

import type { PlayFunctionContext } from 'storybook/internal/csf';

import type { queries } from '../test/testing-library.ts';

expectTypeOf<PlayFunctionContext['canvas']>().toExtend<BoundFunctions<typeof queries>>();
expectTypeOf<PlayFunctionContext['userEvent']>().toExtend<ReturnType<typeof userEvent.setup>>();
