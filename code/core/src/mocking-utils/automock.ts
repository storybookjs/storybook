import { automockModule } from '@vitest/mocker/automock';
import type { Program } from 'estree';

type ParseFn = (code: string) => Program;

export const __STORYBOOK_GLOBAL_THIS_ACCESSOR__ = '__vitest_mocker__';

export function getAutomockCode(originalCode: string, isSpy: boolean, parse: ParseFn) {
  const mocked = automockModule(originalCode, isSpy ? 'autospy' : 'automock', parse, {
    globalThisAccessor: JSON.stringify(__STORYBOOK_GLOBAL_THIS_ACCESSOR__),
  });
  return mocked;
}
