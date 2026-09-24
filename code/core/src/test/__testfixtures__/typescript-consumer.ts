import {
  expect,
  fn,
  isMockFunction,
  mocked,
  spyOn,
  type Mock,
  type Mocked,
  type MockInstance,
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
const returnedNumberMock: Mock<() => number> = returnedNumber;
const returnedNumberInstance: MockInstance<() => number> = returnedNumber;
const returnedNumberMocked: Mocked<{ run: () => number }> = { run: returnedNumber };

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
const calledWithObject = fn((value: { nested: { value: number } }) => value);

const genericIdentity = fn(<T>(value: T) => value);
const defaultedValue = fn<(value?: string) => string>((value = 'default') => value);

const genericString: string = genericIdentity('value');
const genericNumber: number = genericIdentity(1);
defaultedValue();
defaultedValue('value');
// @ts-expect-error A defaulted string parameter cannot be a number.
defaultedValue(1);

const spyTarget = {
  value: 'value',
  method(value: string) {
    return value.length;
  },
  Constructor: class {
    constructor(readonly value: string) {}
  },
};

const getterSpy = spyOn(spyTarget, 'value', 'get');
const setterSpy = spyOn(spyTarget, 'value', 'set');
const methodSpy = spyOn(spyTarget, 'method');
const constructorSpy = spyOn(spyTarget, 'Constructor');

getterSpy.mockReturnValue('value');
setterSpy.mockImplementation((value) => void value.toUpperCase());
methodSpy.mockReturnValue(3);
constructorSpy.mockImplementation(function (value) {
  return new spyTarget.Constructor(value);
});
// @ts-expect-error A string method cannot return a string length as text.
methodSpy.mockReturnValue('three');

void genericString;
void genericNumber;
void returnedNumberMock;
void returnedNumberInstance;
void returnedNumberMocked;

const mockTarget = {
  nested: {
    method(value: { label: string }) {
      return { length: value.label.length };
    },
  },
};

const deeplyMocked = mocked(mockTarget, true);
const defaultMocked = mocked(mockTarget);
const shallowlyMocked = mocked(mockTarget, false);
const explicitlyShallowlyMocked = mocked(mockTarget, { partial: false, deep: false });
const explicitlyDeeplyMocked = mocked(mockTarget, { partial: false, deep: true });
const partiallyShallowlyMocked = mocked(mockTarget, { partial: true, deep: false });
const partiallyDeeplyMockedObject = mocked(mockTarget, { partial: true, deep: true });
const partiallyMocked = mocked(mockTarget.nested.method, { partial: true });
const partiallyDeeplyMockedFunction = mocked(mockTarget.nested.method, {
  partial: true,
  deep: true,
});

deeplyMocked.nested.method.mockReturnValue({ length: 1 });
explicitlyDeeplyMocked.nested.method.mockReturnValue({ length: 1 });
partiallyDeeplyMockedObject.nested.method.mockReturnValue({ length: 1 });
partiallyMocked.mockReturnValue({});
partiallyDeeplyMockedFunction.mockReturnValue({});
// @ts-expect-error A default shallow mock does not mock nested methods.
defaultMocked.nested.method.mockReturnValue({ length: 1 });
// @ts-expect-error A shallow mock does not mock nested methods.
shallowlyMocked.nested.method.mockReturnValue({ length: 1 });
// @ts-expect-error An explicit shallow mock does not mock nested methods.
explicitlyShallowlyMocked.nested.method.mockReturnValue({ length: 1 });
// @ts-expect-error A partial shallow mock does not mock nested methods.
partiallyShallowlyMocked.nested.method.mockReturnValue({ length: 1 });

expect(calledWithString).toHaveBeenCalledWith('value');
expect(calledWithString).toBeCalledWith('value');
expect(calledWithString).toHaveBeenLastCalledWith('value');
expect(calledWithString).lastCalledWith('value');
expect(calledWithString).toHaveBeenNthCalledWith(1, 'value');
expect(calledWithString).nthCalledWith(1, 'value');
expect(calledWithString).toHaveBeenCalledTimes(1);
expect(calledWithString).toBeCalledTimes(1);
expect(calledWithString).toHaveBeenCalledExactlyOnceWith('value');
expect(calledWithObject).toHaveBeenCalledWith(
  expect.objectContaining({ nested: expect.objectContaining({ value: 1 }) })
);
expect(calledWithObject).toHaveReturnedWith(
  expect.objectContaining({ nested: expect.objectContaining({ value: 1 }) })
);
// @ts-expect-error A nested mock argument must retain its value type.
expect(calledWithObject).toHaveBeenCalledWith({ nested: { value: 'one' } });
// @ts-expect-error A nested mock result must retain its value type.
expect(calledWithObject).toHaveReturnedWith({ nested: { value: 'one' } });
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
    const hint: string = this.utils.matcherHint('toBeDivisibleBy');
    const difference: string | null = this.utils.diff(received, expected);
    // @ts-expect-error Matcher utilities reject misspelled members.
    this.utils.matchHint('toBeDivisibleBy');
    this.isNot.valueOf();
    void hint;
    void difference;
    return { message: () => 'expected a divisible number', pass };
  },
});
