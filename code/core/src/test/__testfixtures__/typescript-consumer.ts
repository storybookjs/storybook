import { expect, fn, isMockFunction } from 'storybook/test';

const returnedNumber = fn(() => 3);

expect(returnedNumber).toHaveReturnedWith(3);
expect(returnedNumber).toHaveLastReturnedWith(3);
expect(returnedNumber).toHaveNthReturnedWith(1, 3);

// @ts-expect-error A returned number cannot match a string.
expect(returnedNumber).toHaveReturnedWith('three');
// @ts-expect-error A returned number cannot match an object.
expect(returnedNumber).toHaveReturnedWith({});
// @ts-expect-error A returned number cannot match undefined.
expect(returnedNumber).toHaveReturnedWith(undefined);

const calledWithString = fn((value: string) => value.length);

expect(calledWithString).toHaveBeenCalledWith('value');
// @ts-expect-error A string mock argument cannot be a number.
expect(calledWithString).toHaveBeenCalledWith(1);

fn().mockRejectedValue('failure');

isMockFunction(undefined);

expect.getState().assertionCalls.toFixed();

expect.extend({
  async toBeDivisibleBy(received, expected) {
    const pass =
      typeof received === 'number' && typeof expected === 'number' && received % expected === 0;
    this.assertionCalls += 0;
    return { message: () => 'expected a divisible number', pass };
  },
});
