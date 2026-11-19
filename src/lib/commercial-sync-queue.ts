/** Coalesce invalidations; never overlap reads or overwrite an active interaction. */
export function createCommercialSyncQueue(options: {
  refresh: () => Promise<unknown>;
  onError: (error: unknown) => void;
  onSuccess?: () => void;
  delayMs?: number;
}) {
  let paused = false;
  let pending = false;
  let running = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (disposed || paused || running || !pending || timer) return;
    timer = setTimeout(async () => {
      timer = undefined;
      if (disposed || paused) return;
      pending = false;
      running = true;
      try {
        await options.refresh();
        if (!disposed) options.onSuccess?.();
      } catch (error) {
        if (!disposed) options.onError(error);
      } finally {
        running = false;
        schedule();
      }
    }, options.delayMs ?? 250);
  };
  return {
    request() { pending = true; schedule(); },
    setPaused(value: boolean) { paused = value; schedule(); },
    dispose() { disposed = true; clearTimeout(timer); },
  };
}
