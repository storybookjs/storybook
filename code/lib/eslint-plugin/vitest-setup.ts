import * as vitest from 'vitest';

import { RuleTester } from '@typescript-eslint/rule-tester';

// https://typescript-eslint.io/packages/rule-tester/#vitest
RuleTester.afterAll = vitest.afterAll;
RuleTester.it = vitest.it;
RuleTester.itOnly = vitest.it.only;
RuleTester.describe = vitest.describe;
