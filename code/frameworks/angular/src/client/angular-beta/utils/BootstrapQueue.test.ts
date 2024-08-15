// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Subject, lastValueFrom } from 'rxjs';

import { queueBootstrapping } from './BootstrapQueue';

const instantWaitFor = (fn: () => void) => {
  return vi.waitFor(fn, {
    interval: 0,
  });
};

describe(
  'BootstrapQueue',
  () => {
    beforeEach(async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('@flaky should wait until complete', async () => {
      const pendingSubject = new Subject<void>();
      const bootstrapApp = vi.fn().mockImplementation(async () => {
        return lastValueFrom(pendingSubject);
      });
      const bootstrapAppFinished = vi.fn();

      queueBootstrapping(bootstrapApp).then(() => {
        bootstrapAppFinished();
      });

      await instantWaitFor(() => {
        if (bootstrapApp.mock.calls.length !== 1) {
          throw new Error('bootstrapApp should not have been called yet');
        }
      });

      expect(bootstrapApp).toHaveBeenCalled();
      expect(bootstrapAppFinished).not.toHaveBeenCalled();

      pendingSubject.next();
      pendingSubject.complete();

      await instantWaitFor(() => {
        if (bootstrapAppFinished.mock.calls.length !== 1) {
          throw new Error('bootstrapApp should have been called once');
        }
      });

      expect(bootstrapAppFinished).toHaveBeenCalled();
    });

    it('should prevent following tasks, until the preview tasks are complete', async () => {
      const pendingSubject = new Subject<void>();
      const bootstrapApp = vi.fn().mockImplementation(async () => {
        return lastValueFrom(pendingSubject);
      });
      const bootstrapAppFinished = vi.fn();

      const pendingSubject2 = new Subject<void>();
      const bootstrapApp2 = vi.fn().mockImplementation(async () => {
        return lastValueFrom(pendingSubject2);
      });
      const bootstrapAppFinished2 = vi.fn();

      const pendingSubject3 = new Subject<void>();
      const bootstrapApp3 = vi.fn().mockImplementation(async () => {
        return lastValueFrom(pendingSubject3);
      });
      const bootstrapAppFinished3 = vi.fn();

      queueBootstrapping(bootstrapApp).then(bootstrapAppFinished);
      queueBootstrapping(bootstrapApp2).then(bootstrapAppFinished2);
      queueBootstrapping(bootstrapApp3).then(bootstrapAppFinished3);

      await instantWaitFor(() => {
        if (bootstrapApp.mock.calls.length !== 1) {
          throw new Error('bootstrapApp should have been called once');
        }
      });

      expect(bootstrapApp).toHaveBeenCalled();
      expect(bootstrapAppFinished).not.toHaveBeenCalled();
      expect(bootstrapApp2).not.toHaveBeenCalled();
      expect(bootstrapAppFinished2).not.toHaveBeenCalled();
      expect(bootstrapApp3).not.toHaveBeenCalled();
      expect(bootstrapAppFinished3).not.toHaveBeenCalled();

      pendingSubject.next();
      pendingSubject.complete();

      await instantWaitFor(() => {
        if (bootstrapApp2.mock.calls.length !== 1) {
          throw new Error('bootstrapApp2 should have been called once');
        }
      });

      expect(bootstrapApp).toHaveReturnedTimes(1);
      expect(bootstrapAppFinished).toHaveBeenCalled();
      expect(bootstrapApp2).toHaveBeenCalled();
      expect(bootstrapAppFinished2).not.toHaveBeenCalled();
      expect(bootstrapApp3).not.toHaveBeenCalled();
      expect(bootstrapAppFinished3).not.toHaveBeenCalled();

      pendingSubject2.next();
      pendingSubject2.complete();

      await instantWaitFor(() => {
        if (bootstrapApp3.mock.calls.length !== 1) {
          throw new Error('bootstrapApp3 should have been called once');
        }
      });

      expect(bootstrapApp).toHaveReturnedTimes(1);
      expect(bootstrapAppFinished).toHaveBeenCalled();
      expect(bootstrapApp2).toHaveReturnedTimes(1);
      expect(bootstrapAppFinished2).toHaveBeenCalled();
      expect(bootstrapApp3).toHaveBeenCalled();
      expect(bootstrapAppFinished3).not.toHaveBeenCalled();

      pendingSubject3.next();
      pendingSubject3.complete();

      await instantWaitFor(() => {
        if (bootstrapAppFinished3.mock.calls.length !== 1) {
          throw new Error('bootstrapAppFinished3 should have been called once');
        }
      });

      expect(bootstrapApp).toHaveReturnedTimes(1);
      expect(bootstrapAppFinished).toHaveBeenCalled();
      expect(bootstrapApp2).toHaveReturnedTimes(1);
      expect(bootstrapAppFinished2).toHaveBeenCalled();
      expect(bootstrapApp3).toHaveReturnedTimes(1);
      expect(bootstrapAppFinished3).toHaveBeenCalled();
    });

    it('should throw and continue next bootstrap on error', async () => {
      const pendingSubject = new Subject<void>();
      const bootstrapApp = vi.fn().mockImplementation(async () => {
        return lastValueFrom(pendingSubject);
      });
      const bootstrapAppFinished = vi.fn();
      const bootstrapAppError = vi.fn();

      const pendingSubject2 = new Subject<void>();
      const bootstrapApp2 = vi.fn().mockImplementation(async () => {
        return lastValueFrom(pendingSubject2);
      });
      const bootstrapAppFinished2 = vi.fn();
      const bootstrapAppError2 = vi.fn();

      queueBootstrapping(bootstrapApp).then(bootstrapAppFinished).catch(bootstrapAppError);
      queueBootstrapping(bootstrapApp2).then(bootstrapAppFinished2).catch(bootstrapAppError2);

      await instantWaitFor(() => {
        if (bootstrapApp.mock.calls.length !== 1) {
          throw new Error('bootstrapApp should have been called once');
        }
      });

      expect(bootstrapApp).toHaveBeenCalledTimes(1);
      expect(bootstrapAppFinished).not.toHaveBeenCalled();
      expect(bootstrapApp2).not.toHaveBeenCalled();

      pendingSubject.error(new Error('test error'));

      await instantWaitFor(() => {
        if (bootstrapAppError.mock.calls.length !== 1) {
          throw new Error('bootstrapAppError should have been called once');
        }
      });

      expect(bootstrapApp).toHaveBeenCalledTimes(1);
      expect(bootstrapAppFinished).not.toHaveBeenCalled();
      expect(bootstrapAppError).toHaveBeenCalledTimes(1);
      expect(bootstrapApp2).toHaveBeenCalledTimes(1);
      expect(bootstrapAppFinished2).not.toHaveBeenCalled();
      expect(bootstrapAppError2).not.toHaveBeenCalled();

      pendingSubject2.next();
      pendingSubject2.complete();

      await instantWaitFor(() => {
        if (bootstrapAppFinished2.mock.calls.length !== 1) {
          throw new Error('bootstrapAppFinished2 should have been called once');
        }
      });

      expect(bootstrapApp).toHaveBeenCalledTimes(1);
      expect(bootstrapAppFinished).not.toHaveBeenCalled();
      expect(bootstrapAppError).toHaveBeenCalledTimes(1);
      expect(bootstrapApp2).toHaveBeenCalledTimes(1);
      expect(bootstrapAppFinished2).toHaveBeenCalledTimes(1);
      expect(bootstrapAppError2).not.toHaveBeenCalled();
    });
  },
  { retry: 3 }
);
