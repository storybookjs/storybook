import { Channel, getChannel, setChannel } from 'storybook/internal/channels';

// The Storybook Vitest runtime (browser mode) has no builder preamble to install an addons channel,
// yet preview side-effect modules (open services) call `registerService()` at import time. Install a
// channel here so those registrations have one to bind to.
//
// This lives in its own module and is imported before `./preview.tsx` in the setup file: ES modules
// evaluate their imports in source order, so an inline statement would run *after* the preview import
// (and its service registrations), too late to help.
if (!getChannel()) {
  setChannel(new Channel({}));
}
