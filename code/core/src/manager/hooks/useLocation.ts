import { useEffect, useState } from 'react';

export const LocationMonitor = {
  _currentHref: globalThis.window?.location.href ?? '',
  _intervalId: null as ReturnType<typeof setInterval> | null,
  _listeners: new Set<(location: Location) => void>(),

  start() {
    if (this._intervalId === null) {
      this._intervalId = setInterval(() => {
        const newLocation = globalThis.window.location;
        if (newLocation.href !== this._currentHref) {
          this._currentHref = newLocation.href;
          this._listeners.forEach((listener) => listener(newLocation));
        }
      }, 100);
    }
  },

  stop() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  },

  subscribe(...listeners: Array<(location: Location) => void>) {
    listeners.forEach((listener) => this._listeners.add(listener));
    this.start();
    return () => {
      listeners.forEach((listener) => this._listeners.delete(listener));
      if (this._listeners.size === 0) {
        this.stop();
      }
    };
  },
};

export const useLocationHash = () => {
  const [hash, setHash] = useState(globalThis.window?.location.hash ?? '');
  useEffect(() => LocationMonitor.subscribe((location) => setHash(location.hash)), []);
  return hash.slice(1);
};
