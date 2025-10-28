import { useEffect, useState } from 'react';

const hashMonitor = {
  currentHash: globalThis.window?.location.hash ?? '',
  intervalId: null as ReturnType<typeof setInterval> | null,
  listeners: new Set<(hash: string) => void>(),

  start() {
    if (this.intervalId === null) {
      this.intervalId = setInterval(() => {
        const newHash = globalThis.window.location.hash ?? '';
        if (newHash !== this.currentHash) {
          this.currentHash = newHash;
          this.listeners.forEach((listener) => listener(newHash));
        }
      }, 100);
    }
  },
  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  },
  subscribe(...listeners: Array<(hash: string) => void>) {
    listeners.forEach((listener) => this.listeners.add(listener));
    this.start();
    return () => {
      listeners.forEach((listener) => this.listeners.delete(listener));
      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  },
};

export const useLocationHash = () => {
  const [hash, setHash] = useState(globalThis.window?.location.hash ?? '');
  useEffect(() => hashMonitor.subscribe(setHash), []);
  return hash.slice(1);
};
