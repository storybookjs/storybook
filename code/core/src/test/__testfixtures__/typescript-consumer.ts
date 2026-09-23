import {
  expect,
  fn,
  isMockFunction,
  type MockResult,
  type MockSettledResult,
} from 'storybook/test';

declare module 'storybook/test' {
  interface Assertion<T> {
    toBeEven(): Promise<void>;
  }
}

expect(2).toBeEven();
expect.toSatisfy((value) => value >= 18);
expect.not.toSatisfy((value) => value >= 18);

const returnedNumber = fn(() => 3);

expect(returnedNumber).toHaveReturnedWith(3);
expect(returnedNumber).toHaveLastReturnedWith(3);
expect(returnedNumber).toHaveNthReturnedWith(1, 3);
expect(returnedNumber).toHaveReturned();
expect(returnedNumber).toReturn();
expect(returnedNumber).toReturnTimes(1);
expect(returnedNumber).toReturnWith(3);
expect(returnedNumber).lastReturnedWith(3);
expect(returnedNumber).nthReturnedWith(1, 3);

// @ts-expect-error A returned number cannot match a string.
expect(returnedNumber).toHaveReturnedWith('three');
// @ts-expect-error A returned number cannot match an object.
expect(returnedNumber).toHaveReturnedWith({});
// @ts-expect-error A returned number cannot match undefined.
expect(returnedNumber).toHaveReturnedWith(undefined);

const calledWithString = fn((value: string) => value.length);

expect(calledWithString).toHaveBeenCalledWith('value');
expect(calledWithString).toBeCalledWith('value');
expect(calledWithString).toHaveBeenLastCalledWith('value');
expect(calledWithString).lastCalledWith('value');
expect(calledWithString).toHaveBeenNthCalledWith(1, 'value');
expect(calledWithString).nthCalledWith(1, 'value');
expect(calledWithString).toHaveBeenCalledTimes(1);
expect(calledWithString).toBeCalledTimes(1);
expect(calledWithString).toHaveBeenCalledExactlyOnceWith('value');
expect(calledWithString).toHaveLength(1);
expect('value').toMatch('value');
expect(3).toBeGreaterThan(2);
// @ts-expect-error A string mock argument cannot be a number.
expect(calledWithString).toHaveBeenCalledWith(1);
// @ts-expect-error Call-count matchers require a number.
expect(calledWithString).toHaveBeenCalledTimes('one');
// @ts-expect-error An exact-call matcher requires the mock's arguments.
expect(calledWithString).toHaveBeenCalledExactlyOnceWith(1);
// @ts-expect-error A string matcher accepts strings or regular expressions.
expect('value').toMatch(1);
// @ts-expect-error Comparison matchers require numbers or bigints.
expect(3).toBeGreaterThan('two');

fn().mockRejectedValue('failure');

isMockFunction(undefined);

expect.getState().assertionCalls.toFixed();
expect.getState().testPath?.toUpperCase();
expect.setState({ testPath: 'test.ts' });
expect.setState({
  customTesters: [
    function (a, b, testers) {
      return this.equals(a, b, testers);
    },
  ],
});

const thrown: MockResult<void> = { type: 'throw', value: 'failure' };
const rejected: MockSettledResult<void> = { type: 'rejected', value: undefined };

void thrown;
void rejected;

expect.extend({
  async toBeDivisibleBy(received, expected) {
    const pass =
      typeof received === 'number' && typeof expected === 'number' && received % expected === 0;
    this.assertionCalls += 0;
    this.equals(received, expected);
    this.utils.matcherHint('toBeDivisibleBy');
    // @ts-expect-error Matcher utilities reject misspelled members.
    this.utils.matchHint('toBeDivisibleBy');
    this.isNot.valueOf();
    return { message: () => 'expected a divisible number', pass };
  },
});
