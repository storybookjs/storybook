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

const assertion: Promise<void> = expect(2).toBe(2);
const negatedAssertion: Promise<void> = expect(2).not.toBe(3);
const resolvedAssertion: Promise<void> = expect(Promise.resolve(2)).resolves.toBe(2);
const domAssertion: Promise<void> = expect(document.body).toBeInTheDocument();

expect(2).toBeEven();
expect.toSatisfy((value) => value >= 18);
expect.not.toSatisfy((value) => value >= 18);

void assertion;
void negatedAssertion;
void resolvedAssertion;
void domAssertion;

const numberMock = fn(() => 3);
const typedMock: Mock<() => number> = numberMock;
const mockInstance: MockInstance<() => number> = numberMock;
const mockedObject: Mocked<{ run: () => number }> = { run: numberMock };

expect(numberMock).toHaveReturnedWith(3);
expect(numberMock).toReturnTimes(1);

void typedMock;
void mockInstance;
void mockedObject;

const genericMock = fn(<T>(value: T) => value);
const defaultedMock = fn<(value?: string) => string>((value = 'default') => value);

const stringResult: string = genericMock('value');
const numberResult: number = genericMock(1);
defaultedMock();
defaultedMock('value');
// @ts-expect-error The defaulted parameter accepts strings only.
defaultedMock(1);

void stringResult;
void numberResult;

const spyTarget = {
  value: 'value',
  method(value: string) {
    return value.length;
  },
  Constructor: class {
    constructor(readonly value: string) {}
  },
};

spyOn(spyTarget, 'value', 'get').mockReturnValue('value');
spyOn(spyTarget, 'value', 'set').mockImplementation((value) => void value.toUpperCase());
const methodSpy = spyOn(spyTarget, 'method').mockReturnValue(3);
spyOn(spyTarget, 'Constructor').mockImplementation(function (value) {
  return new spyTarget.Constructor(value);
});
// @ts-expect-error The method returns a number.
methodSpy.mockReturnValue('three');

const mockTarget = {
  nested: {
    method(value: { label: string }) {
      return { length: value.label.length };
    },
  },
};

mocked(mockTarget, true).nested.method.mockReturnValue({ length: 1 });
mocked(mockTarget, { partial: false, deep: true }).nested.method.mockReturnValue({ length: 1 });
mocked(mockTarget.nested.method, { partial: true, deep: true }).mockReturnValue({});
// @ts-expect-error A shallow mock does not mock nested methods.
mocked(mockTarget).nested.method.mockReturnValue({ length: 1 });

const stringMock = fn((value: string) => value.length);
const objectMock = fn((value: { nested: { value: number } }) => value);
const nestedValue = expect.objectContaining({ nested: expect.objectContaining({ value: 1 }) });

expect(stringMock).toHaveBeenCalledWith('value');
expect(stringMock).toHaveBeenCalledTimes(1);
expect(objectMock).toHaveReturnedWith(nestedValue);
// @ts-expect-error Call-count matchers require a number.
expect(stringMock).toHaveBeenCalledTimes('one');

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
    this.utils.diff(received, expected);
    this.isNot.valueOf();
    // @ts-expect-error Matcher utilities reject misspelled members.
    this.utils.matchHint('toBeDivisibleBy');
    return { message: () => 'expected a divisible number', pass };
  },
});
