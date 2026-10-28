// The test installs this probe; main.ts calls it while it is being evaluated.
const probe = (globalThis as { __mainAccessorProbe?: () => void }).__mainAccessorProbe;
probe?.();

export default {
  stories: [],
};
