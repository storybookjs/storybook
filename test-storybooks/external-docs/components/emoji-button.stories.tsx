import React from 'react';
import { EmojiButton } from './emoji-button';

export default { component: EmojiButton, title: 'Examples / Emoji Button' };

export const WithArgs = (args: any) => <EmojiButton {...args} />;
WithArgs.args = { label: 'With args' };
export const Basic = () => <EmojiButton label="Click me" />;
