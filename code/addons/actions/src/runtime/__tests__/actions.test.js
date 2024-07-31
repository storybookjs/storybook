import { describe, it, expect, vi } from 'vitest';
import { addons } from 'storybook/internal/preview-api';
import { actions } from '../..';

vi.mock('storybook/internal/preview-api');

const createChannel = () => {
  const channel = { emit: vi.fn() };
  addons.getChannel.mockReturnValue(channel);
  return channel;
};
const getChannelData = (channel, callIndex) => channel.emit.mock.calls[callIndex][1].data;
const getChannelOptions = (channel, callIndex) => channel.emit.mock.calls[callIndex][1].options;

describe('Actions', () => {
  it('with one argument', () => {
    const channel = createChannel();

    const actionsResult = actions('test-action');

    expect(Object.keys(actionsResult)).toEqual(['test-action']);
    actionsResult['test-action']('one');

    expect(getChannelData(channel, 0)).toEqual({ name: 'test-action', args: 'one' });
  });

  it('with multiple arguments', () => {
    const channel = createChannel();

    const actionsResult = actions('test-action', 'test-action2');

    expect(Object.keys(actionsResult)).toEqual(['test-action', 'test-action2']);

    actionsResult['test-action']('one');
    actionsResult['test-action2']('two');

    expect(getChannelData(channel, 0)).toEqual({ name: 'test-action', args: 'one' });
    expect(getChannelData(channel, 1)).toEqual({ name: 'test-action2', args: 'two' });
  });

  it('with multiple arguments + config', () => {
    const channel = createChannel();

    const actionsResult = actions('test-action', 'test-action2', { some: 'config' });

    expect(Object.keys(actionsResult)).toEqual(['test-action', 'test-action2']);

    actionsResult['test-action']('one');
    actionsResult['test-action2']('two');

    expect(getChannelData(channel, 0)).toEqual({ name: 'test-action', args: 'one' });
    expect(getChannelData(channel, 1)).toEqual({ name: 'test-action2', args: 'two' });

    expect(getChannelOptions(channel, 0).some).toEqual('config');
    expect(getChannelOptions(channel, 1).some).toEqual('config');
  });

  it('with multiple arguments as object', () => {
    const channel = createChannel();

    const actionsResult = actions({
      'test-action': 'test action',
      'test-action2': 'test action two',
    });

    expect(Object.keys(actionsResult)).toEqual(['test-action', 'test-action2']);

    actionsResult['test-action']('one');
    actionsResult['test-action2']('two');

    expect(getChannelData(channel, 0)).toEqual({ name: 'test action', args: 'one' });
    expect(getChannelData(channel, 1)).toEqual({ name: 'test action two', args: 'two' });
  });

  it('with first argument as array of arguments + config', () => {
    const channel = createChannel();

    const actionsResult = actions(['test-action', 'test-action2', { some: 'config' }]);

    expect(Object.keys(actionsResult)).toEqual(['test-action', 'test-action2']);

    actionsResult['test-action']('one');
    actionsResult['test-action2']('two');

    expect(getChannelData(channel, 0)).toEqual({ name: 'test-action', args: 'one' });
    expect(getChannelData(channel, 1)).toEqual({ name: 'test-action2', args: 'two' });

    expect(getChannelOptions(channel, 0).some).toEqual('config');
    expect(getChannelOptions(channel, 1).some).toEqual('config');
  });
});
