// Workbox's isUpdate flag can be false for an update arriving in the same
// window as the first install. Observe the actual controller handover instead.
export async function activateAppUpdate() {
  const registration = await navigator.serviceWorker.getRegistration();
  const waiting = registration?.waiting;
  if (waiting) {
    const previous = navigator.serviceWorker.controller;
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        navigator.serviceWorker.removeEventListener('controllerchange', changed);
      };
      const changed = () => {
        if (navigator.serviceWorker.controller && navigator.serviceWorker.controller !== previous) {
          cleanup(); resolve();
        }
      };
      const timeout = window.setTimeout(() => { cleanup(); reject(new Error('Update did not activate')); }, 15000);
      navigator.serviceWorker.addEventListener('controllerchange', changed);
      try {
        waiting.postMessage({ type: 'SKIP_WAITING' });
        changed();
      } catch (error) { cleanup(); reject(error); }
    });
  }
  // With no waiting worker, another app window may already have activated it.
  window.location.reload();
}
